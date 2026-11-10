import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";
@Catch()
export class Errors implements ExceptionFilter {
  private readonly logger = new Logger(Errors.name);
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500;
    let message: unknown = "Error interno";
    if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.getResponse();
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping: Record<string, [number, string]> = {
        P2002: [409, "Registro duplicado"],
        P2003: [400, "Referencia inválida"],
        P2025: [404, "Registro no encontrado"],
        P2034: [409, "Conflicto concurrente; reintenta con la misma clave"],
      };
      [status, message] = mapping[error.code] ?? [500, "Error interno"];
    }
    if (status === 500)
      this.logger.error(error instanceof Error ? error.name : "UnknownError");
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, error: message });
  }
}
