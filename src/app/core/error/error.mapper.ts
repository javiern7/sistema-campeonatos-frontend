import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { AppError } from './app-error.model';

@Injectable({ providedIn: 'root' })
export class ErrorMapper {
  map(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const payload = error.error ?? {};
      const message = payload.message ?? this.defaultMessage(error.status);
      return new AppError(error.status, message, payload.code, payload.errors);
    }

    return new AppError(0, 'Ocurrió un error inesperado');
  }

  private defaultMessage(status: number): string {
    switch (status) {
      case 401:
        return 'Sesión inválida o credenciales incorrectas';
      case 403:
        return 'No tienes permisos para realizar esta acción';
      case 404:
        return 'No se encontró el recurso solicitado';
      case 409:
        return 'La operación entra en conflicto con el estado actual';
      case 500:
        return 'Ocurrió un error interno en el servidor';
      default:
        return 'No se pudo completar la solicitud';
    }
  }
}
