import net from "node:net";
import tls from "node:tls";
import { env } from "../env.js";
import { ApiError } from "../http.js";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SmtpSocket = net.Socket | tls.TLSSocket;
type EmailLogger = {
  info: (value: object, message?: string) => void;
  error: (value: object, message?: string) => void;
};

const SMTP_TIMEOUT_MS = 15_000;

const sanitizeHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const encodeBase64 = (value: string) => Buffer.from(value, "utf8").toString("base64");
const getSmtpFromAddress = () => {
  const from = env.SMTP_FROM ?? "";
  return from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();
};
const getErrorLog = (error: unknown) =>
  error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        code: "code" in error ? error.code : undefined,
        cause: error.cause
      }
    : { message: String(error) };

const getSmtpLogConfig = () => ({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  hasUser: Boolean(env.SMTP_USER),
  hasPassword: Boolean(env.SMTP_PASSWORD),
  from: getSmtpFromAddress()
});

const readResponse = (socket: SmtpSocket) =>
  new Promise<string>((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("SMTP timeout"));
    };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines.at(-1);
      if (lastLine && /^\d{3} /.test(lastLine)) {
        cleanup();
        resolve(buffer);
      }
    };

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("timeout", onTimeout);
  });

const sendCommand = async (socket: SmtpSocket, command: string, expectedCodes: number[]) => {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) {
    const error = new Error(`SMTP rechazo el comando ${command.split(" ")[0]} con codigo ${code}`);
    error.cause = response
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.replace(/[A-Za-z0-9+/=]{24,}/g, "[redacted]"))
      .join(" ");
    throw error;
  }
  return response;
};

const connectSmtp = () =>
  new Promise<SmtpSocket>((resolve, reject) => {
    const options = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT
    };
    const socket = env.SMTP_SECURE ? tls.connect(options) : net.connect(options);
    const timeout = setTimeout(() => {
      socket.destroy(new Error("SMTP connection timeout"));
    }, SMTP_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off(env.SMTP_SECURE ? "secureConnect" : "connect", onConnect);
      socket.off("error", onError);
    };
    const onConnect = () => {
      cleanup();
      socket.setTimeout(SMTP_TIMEOUT_MS);
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once(env.SMTP_SECURE ? "secureConnect" : "connect", onConnect);
    socket.once("error", onError);
  });

const upgradeToTls = (socket: SmtpSocket) =>
  new Promise<tls.TLSSocket>((resolve, reject) => {
    const tlsSocket = tls.connect({
      socket,
      host: env.SMTP_HOST,
      servername: env.SMTP_HOST
    });
    tlsSocket.setTimeout(SMTP_TIMEOUT_MS);
    tlsSocket.once("secureConnect", () => resolve(tlsSocket));
    tlsSocket.once("error", reject);
    tlsSocket.once("timeout", () => reject(new Error("SMTP TLS timeout")));
  });

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const buildMimeMessage = ({ to, subject, text, html }: EmailMessage) => {
  const boundary = `onlycartitas-${Date.now().toString(36)}`;
  const from = env.SMTP_FROM ?? "";
  return [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${boundary}--`,
    ".",
    ""
  ].join("\r\n");
};

export async function sendEmail(message: EmailMessage, logger?: EmailLogger) {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    if (env.NODE_ENV === "production") throw new ApiError(500, "El envio de correos no esta configurado");
    console.info("[onlycartitas] Email omitido por falta de SMTP", {
      to: message.to,
      subject: message.subject,
      text: message.text
    });
    return;
  }

  let socket: SmtpSocket | undefined;
  let phase = "connect";
  logger?.info({ smtp: getSmtpLogConfig(), phase }, "SMTP send starting");
  try {
    socket = await connectSmtp();
    phase = "greeting";
    await readResponse(socket);
    phase = "ehlo";
    const greeting = await sendCommand(socket, `EHLO ${env.API_PUBLIC_URL ? new URL(env.API_PUBLIC_URL).hostname : "localhost"}`, [250]);

    if (!env.SMTP_SECURE && greeting.toUpperCase().includes("STARTTLS")) {
      phase = "starttls";
      await sendCommand(socket, "STARTTLS", [220]);
      phase = "tls-upgrade";
      socket = await upgradeToTls(socket);
      phase = "ehlo-after-starttls";
      await sendCommand(socket, `EHLO ${env.API_PUBLIC_URL ? new URL(env.API_PUBLIC_URL).hostname : "localhost"}`, [250]);
    }

    if (env.SMTP_USER && env.SMTP_PASSWORD) {
      phase = "auth";
      await sendCommand(socket, `AUTH PLAIN ${encodeBase64(`\u0000${env.SMTP_USER}\u0000${env.SMTP_PASSWORD}`)}`, [235]);
    }

    phase = "mail-from";
    await sendCommand(socket, `MAIL FROM:<${sanitizeHeader(getSmtpFromAddress())}>`, [250]);
    phase = "rcpt-to";
    await sendCommand(socket, `RCPT TO:<${sanitizeHeader(message.to)}>`, [250, 251]);
    phase = "data";
    await sendCommand(socket, "DATA", [354]);
    await sendCommand(socket, buildMimeMessage(message), [250]);
    phase = "quit";
    await sendCommand(socket, "QUIT", [221]);
    logger?.info({ smtp: getSmtpLogConfig() }, "SMTP send completed");
  } catch (error) {
    logger?.error({ smtp: getSmtpLogConfig(), phase, err: getErrorLog(error) }, "SMTP send failed");
    throw new ApiError(500, "No se pudo enviar el correo de recuperacion");
  } finally {
    socket?.end();
  }
}

export function buildPasswordResetEmail(to: string, resetUrl: string): EmailMessage {
  const safeUrl = escapeHtml(resetUrl);
  return {
    to,
    subject: "Restablece tu clave de OnlyCartitas",
    text: `Usa este link para cambiar tu clave de OnlyCartitas. Expira pronto y se puede usar una sola vez:\n\n${resetUrl}`,
    html: `<p>Usa este link para cambiar tu clave de OnlyCartitas. Expira pronto y se puede usar una sola vez.</p><p><a href="${safeUrl}">Cambiar clave</a></p><p>${safeUrl}</p>`
  };
}
