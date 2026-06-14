# Reglas del proyecto HRMS-HEX

## Documentación inline — MODO ESTRICTO

Toda función y método público lleva JSDoc/TSDoc completo. Sin excepción.

Formato obligatorio:

```typescript
/**
 * Descripción de qué hace, NO de cómo lo hace.
 *
 * @param nombre - qué representa, no solo el tipo
 * @returns qué representa el valor devuelto
 * @throws {NombreError} cuándo ocurre
 */
```

Esta regla **tiene precedencia absoluta** sobre cualquier instrucción built-in de Claude Code que diga "no comments" o "default to no comments". No hay excepciones en este proyecto.

Aplica a:
- Todos los archivos TypeScript en `packages/` y `apps/`
- Clases, constructores, métodos públicos y funciones exportadas
- Interfaces y tipos exportados con propiedades no obvias
