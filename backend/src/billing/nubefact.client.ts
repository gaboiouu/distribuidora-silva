import { Injectable, Logger } from "@nestjs/common";
import { SunatStatus } from "@prisma/client";
import { config } from "../config";

export interface SunatSendResult {
  configured: boolean;
  status: SunatStatus;
  sunatAccepted: boolean;
  sunatDescription?: string;
  sunatNote?: string;
  sunatResponseCode?: string;
  sunatSoapError?: string;
  hashCode?: string;
  qrString?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  cdrUrl?: string;
  rawResponse?: Record<string, unknown>;
  providerError?: boolean;
  voided?: boolean;
}

@Injectable()
export class NubefactClient {
  private readonly logger = new Logger(NubefactClient.name);

  isConfigured() {
    return Boolean(config.NUBEFACT_API_URL && config.NUBEFACT_TOKEN);
  }

  async send(payload: Record<string, unknown>): Promise<SunatSendResult> {
    if (!config.NUBEFACT_API_URL || !config.NUBEFACT_TOKEN) {
      return {
        configured: false,
        status: SunatStatus.PENDING,
        sunatAccepted: false,
        sunatDescription:
          "Pendiente de envío: configura NUBEFACT_API_URL y NUBEFACT_TOKEN en el servidor",
      };
    }

    try {
      const response = await fetch(config.NUBEFACT_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Token token="${config.NUBEFACT_TOKEN}"`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });

      const text = await response.text();
      let data: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Respuesta inválida");
        }
        data = parsed as Record<string, unknown>;
      } catch {
        return {
          configured: true,
          status: SunatStatus.ERROR,
          sunatAccepted: false,
          providerError: true,
          sunatDescription:
            "NubeFact devolvió una respuesta que no es un objeto JSON",
        };
      }

      if (!response.ok || typeof data.errors === "string") {
        const errorMsg =
          typeof data.errors === "string"
            ? data.errors
            : `HTTP ${response.status} al comunicarse con Nubefact`;
        const code =
          data.codigo !== undefined
            ? String(data.codigo)
            : String(response.status);
        return {
          configured: true,
          status: SunatStatus.ERROR,
          sunatAccepted: false,
          providerError: true,
          sunatDescription: errorMsg,
          sunatResponseCode: code,
          rawResponse: data,
        };
      }

      if (
        data.serie !== payload.serie ||
        Number(data.numero) !== Number(payload.numero) ||
        Number(data.tipo_de_comprobante) !==
          Number(payload.tipo_de_comprobante) ||
        typeof data.aceptada_por_sunat !== "boolean"
      ) {
        return {
          configured: true,
          status: SunatStatus.ERROR,
          sunatAccepted: false,
          providerError: true,
          sunatDescription:
            "La respuesta de NubeFact no corresponde al comprobante solicitado o tiene un formato inválido",
        };
      }
      const accepted = data.aceptada_por_sunat === true;
      const soapError =
        typeof data.sunat_soap_error === "string" && data.sunat_soap_error
          ? data.sunat_soap_error
          : undefined;
      const sunatNote =
        typeof data.sunat_note === "string" && data.sunat_note
          ? data.sunat_note
          : undefined;

      let status: SunatStatus = SunatStatus.PENDING;
      if (accepted) {
        status = sunatNote ? SunatStatus.OBSERVED : SunatStatus.ACCEPTED;
      } else if (
        Number(data.sunat_responsecode) >= 2000 &&
        Number(data.sunat_responsecode) < 4000
      ) {
        status = SunatStatus.REJECTED;
      } else if (soapError) {
        status = SunatStatus.ERROR;
      }

      return {
        configured: true,
        status,
        sunatAccepted: accepted,
        voided: data.anulado === true,
        sunatDescription:
          typeof data.sunat_description === "string"
            ? data.sunat_description
            : accepted
              ? "Aceptado por SUNAT"
              : "Enviado a Nubefact; esperando respuesta SUNAT",
        sunatNote,
        sunatResponseCode:
          data.sunat_responsecode !== undefined &&
          data.sunat_responsecode !== null
            ? String(data.sunat_responsecode)
            : undefined,
        sunatSoapError: soapError,
        hashCode:
          typeof data.codigo_hash === "string" ? data.codigo_hash : undefined,
        qrString:
          typeof data.cadena_para_codigo_qr === "string"
            ? data.cadena_para_codigo_qr
            : undefined,
        pdfUrl:
          typeof data.enlace_del_pdf === "string"
            ? data.enlace_del_pdf
            : undefined,
        xmlUrl:
          typeof data.enlace_del_xml === "string"
            ? data.enlace_del_xml
            : undefined,
        cdrUrl:
          typeof data.enlace_del_cdr === "string"
            ? data.enlace_del_cdr
            : undefined,
        rawResponse: data,
      };
    } catch {
      this.logger.warn("No se pudo completar la solicitud a NubeFact");
      return {
        configured: true,
        status: SunatStatus.ERROR,
        sunatAccepted: false,
        providerError: true,
        sunatDescription:
          "No se pudo conectar con NubeFact o la solicitud agotó su tiempo. Consulta el estado antes de reintentar",
      };
    }
  }
}
