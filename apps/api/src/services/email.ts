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

const sanitizeHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const encodeBase64 = (value: string) => Buffer.from(value, "utf8").toString("base64");
const getSmtpFromAddress = () => {
  const from = env.SMTP_FROM ?? "";
  return from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();
};

const readResponse = (socket: SmtpSocket) =>
  new Promise<string>((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
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
  });

const sendCommand = async (socket: SmtpSocket, command: string, expectedCodes: number[]) => {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  const code = Number(response.slice(0, 3));
  if (!expectedCodes.includes(code)) throw new Error(`SMTP rechazo el comando ${command.split(" ")[0]}`);
  return response;
};

const connectSmtp = () =>
  new Promise<SmtpSocket>((resolve, reject) => {
    const options = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT
    };
    const socket = env.SMTP_SECURE ? tls.connect(options) : net.connect(options);
    socket.once(env.SMTP_SECURE ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
  });

const upgradeToTls = (socket: SmtpSocket) =>
  new Promise<tls.TLSSocket>((resolve, reject) => {
    const tlsSocket = tls.connect({
      socket,
      host: env.SMTP_HOST,
      servername: env.SMTP_HOST
    });
    tlsSocket.once("secureConnect", () => resolve(tlsSocket));
    tlsSocket.once("error", reject);
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

export async function sendEmail(message: EmailMessage) {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    if (env.NODE_ENV === "production") throw new ApiError(500, "El envio de correos no esta configurado");
    console.info("[onlycartitas] Email omitido por falta de SMTP", {
      to: message.to,
      subject: message.subject,
      text: message.text
    });
    return;
  }

  let socket = await connectSmtp();
  try {
    await readResponse(socket);
    const greeting = await sendCommand(socket, `EHLO ${env.API_PUBLIC_URL ? new URL(env.API_PUBLIC_URL).hostname : "localhost"}`, [250]);

    if (!env.SMTP_SECURE && greeting.toUpperCase().includes("STARTTLS")) {
      await sendCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket);
      await sendCommand(socket, `EHLO ${env.API_PUBLIC_URL ? new URL(env.API_PUBLIC_URL).hostname : "localhost"}`, [250]);
    }

    if (env.SMTP_USER && env.SMTP_PASSWORD) {
      await sendCommand(socket, `AUTH PLAIN ${encodeBase64(`\u0000${env.SMTP_USER}\u0000${env.SMTP_PASSWORD}`)}`, [235]);
    }

    await sendCommand(socket, `MAIL FROM:<${sanitizeHeader(getSmtpFromAddress())}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${sanitizeHeader(message.to)}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    await sendCommand(socket, buildMimeMessage(message), [250]);
    await sendCommand(socket, "QUIT", [221]);
  } catch {
    throw new ApiError(500, "No se pudo enviar el correo de recuperacion");
  } finally {
    socket.end();
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
