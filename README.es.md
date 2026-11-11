# EGM para OpenCode V2

**Elephant-Goldfish Model (EGM) como instalación nativa de OpenCode V2: diseña con contexto, revisa con ojos frescos.**

[English](README.md) · [Español](README.es.md)

Este repositorio es un **adaptador no oficial** que instala el [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) en [OpenCode](https://opencode.ai) V2. Incluye una copia fijada de las skills, personas y estándares de documentación de upstream, y genera los agentes, comandos y permisos de OpenCode necesarios para ejecutar el flujo.

EGM no es un generador de código. Es un flujo de diseño y revisión:

| Rol | Contexto | Responsabilidad |
| --- | --- | --- |
| **Elephant** | Tu proyecto, requisitos y decisiones anteriores | Explora el problema y redacta la especificación. |
| **Goldfish** | El documento y las fuentes referenciadas, sin la conversación anterior | Encuentra supuestos faltantes, requisitos ambiguos y riesgos de implementación. |
| **Tú** | Objetivos y restricciones | Resuelves los trade-offs, apruebas el diseño y decides qué construir. |

Los revisores solo aportan valor si de verdad reciben contexto fresco. Este adaptador ejecuta cada Goldfish como un subagente de OpenCode en una sesión hija con permisos de solo lectura.

## Requisitos

- **OpenCode V2** (probado con `2.2.7` en Windows 11).
- **Node.js 18 o superior** para el instalador.
- No hace falta Python, symlinks ni permisos de administrador.

El adaptador usa las interfaces V2 `subagent` y `permissions`. No usa las interfaces antiguas V1 `task` / `permission`.

## Instalación

Clona el repositorio y ejecuta el instalador:

```sh
git clone https://github.com/MaxiGP0/egm-opencode.git
cd egm-opencode
node bin/egm-opencode.mjs install --global
```

Esto escribe en el directorio global de configuración de OpenCode:

```text
~/.config/opencode/
├── skills/egm-*/          # 7 skills de EGM
├── agents/egm*.md         # orquestador + 8 revisores + explorador + worker de bootstrap
├── commands/egm-*.md      # 7 comandos /
└── egm/                   # bundle fijado: personas, recursos, docs
```

En Windows, `~` es `%USERPROFILE%`. Si `XDG_CONFIG_HOME` está definido, el instalador lo usa.

### Instalación local a un proyecto

Para mantener EGM dentro de un solo repositorio en lugar de tu configuración global:

```sh
node bin/egm-opencode.mjs install --project /ruta/al/proyecto
```

Esto escribe en `/ruta/al/proyecto/.opencode/` con la misma estructura.

### Comprobar, actualizar y desinstalar

```sh
# Ver qué está instalado y si los archivos cambiaron
node bin/egm-opencode.mjs status --global

# Después de git pull, reinstala. Los archivos gestionados sin modificar se actualizan.
node bin/egm-opencode.mjs install --global

# Elimina solo los archivos que instaló egm-opencode
node bin/egm-opencode.mjs uninstall --global
```

El instalador nunca edita `opencode.json`. Solo agrega agentes, comandos y skills en Markdown autocontenidos, así que tu configuración existente queda intacta. OpenCode los recarga automáticamente.

Si ya existe un archivo con el mismo nombre y no lo instaló esta herramienta, el instalador se detiene y lista el conflicto. Vuelve a ejecutar con `--force` para mover el archivo existente a un backup con marca de tiempo.

## Uso

Inicia OpenCode con el agente EGM:

```sh
opencode --agent egm
```

O, en una sesión existente, selecciona el agente **`egm`** en el selector de agentes (Tab) y ejecuta uno de los comandos:

```text
/egm-brainstorm Agregar entrega de webhooks a este proyecto.
/egm-draft
/egm-review docs/designs/webhooks.md
```

También puedes pedir una skill por nombre en un mensaje normal:

```text
Usa la skill egm-review para revisar docs/designs/webhooks.md.
```

Usa mensajes normales para material de revisión no confiable. OpenCode expande marcadores de shell en los argumentos de los comandos antes de que apliquen los permisos de herramientas, así que no pegues texto no confiable en argumentos de `/egm-*`. Las plantillas de este repositorio no contienen bloques de shell.

### El flujo

1. **`/egm-brainstorm`** explora la idea contigo y escribe `concepts_brief.md` después de que siete revisores la cuestionan.
2. **`/egm-draft`** convierte el brief en `design_draft.md`, pausando para recibir feedback mientras escribe las secciones.
3. **`/egm-review`** ejecuta cinco etapas con revisores frescos: Zoom Out, Comprensión, Crítica, Zoom Out intermedio y Preparación para implementación.
4. **`/egm-resolve`** trabaja los hallazgos y aplica solo las ediciones que apruebas.
5. **`/egm-bootstrap`** documenta un codebase existente; **`/egm-drift-report`** compara los documentos versionados con el código actual.

El flujo escribe artefactos en el directorio de trabajo del proyecto por defecto. Para usar otra carpeta, agrega esta línea a tu prompt o a un `AGENTS.md` cargado:

```text
EGM artifact directory: .dev/docs
```

Una ruta relativa se resuelve contra el directorio de trabajo del proyecto. Los documentos de diseño y otros archivos versionados del proyecto no se mueven.

### Comandos

| Comando | Qué hace |
| --- | --- |
| `/egm-brainstorm` | Explora una idea y escribe `concepts_brief.md`. |
| `/egm-draft` | Convierte un brief o notas en un documento de diseño. |
| `/egm-review` | Revisa un diseño con cinco etapas de contexto fresco. |
| `/egm-review-loop` | Ejecuta un grupo configurado de revisores sobre un objetivo. |
| `/egm-resolve` | Trabaja los hallazgos y aplica las ediciones aprobadas. |
| `/egm-bootstrap` | Crea o actualiza documentación de un codebase existente. |
| `/egm-drift-report` | Compara documentos versionados con el código actual. |

## Cómo funciona la integración con OpenCode

- **Agente primario `egm`**: el Elephant. Solo puede cargar skills `egm-*` y lanzar subagentes `egm-*`. Puede leer, buscar y escribir archivos del proyecto; los comandos de shell y la mayoría de las demás herramientas piden aprobación.
- **Ocho subagentes revisores** (`egm-design`, `egm-structural`, `egm-style`, `egm-zoom-out`, `egm-comprehension`, `egm-implementation-readiness`, `egm-codebase-details`, `egm-inventive-catalyst`): cada uno corre en una sesión hija fresca, solo puede leer/glob, y no puede editar, ejecutar shell, buscar con grep, delegar ni cargar skills.
- **`egm-explorer`**: explorador de solo lectura para bootstrap. Devuelve resúmenes JSON de interfaz, invariantes y efectos secundarios.
- **`egm-bootstrap-worker`**: sub-orquestador de bootstrap que puede escribir documentación dentro de su subárbol asignado y lanzar solo `egm-explorer`.
- **Sin agente `egm-synthesizer`**: el sintetizador de upstream es un orquestador anidado. Este adaptador despacha a los revisores directamente desde el Elephant y sintetiza los hallazgos en el padre. Así evita depender del soporte de subagentes anidados.
- **Las skills se mantienen canónicas**: los `SKILL.md` y las personas se copian de upstream. El adaptador agrega un preámbulo al system prompt que mapea los nombres específicos de cada harness a OpenCode V2 (`subagent`, `agent`, sin `sessionID`, ejecución en primer plano) y le indica al Elephant que ignore los documentos específicos de Claude/Codex.

### Estructura instalada

```text
<config-root>/
├── skills/
│   ├── egm-brainstorm/SKILL.md
│   ├── egm-draft/SKILL.md
│   ├── egm-review/SKILL.md
│   ├── egm-review-loop/SKILL.md
│   ├── egm-resolve/SKILL.md
│   ├── egm-bootstrap/SKILL.md
│   └── egm-drift-report/SKILL.md
├── agents/
│   ├── egm.md
│   ├── egm-design.md
│   ├── egm-structural.md
│   ├── egm-style.md
│   ├── egm-zoom-out.md
│   ├── egm-comprehension.md
│   ├── egm-implementation-readiness.md
│   ├── egm-codebase-details.md
│   ├── egm-inventive-catalyst.md
│   ├── egm-explorer.md
│   └── egm-bootstrap-worker.md
├── commands/
│   └── egm-*.md
└── egm/
    ├── install.json          # versiones, commit de upstream, hashes
    ├── UPSTREAM.json
    ├── agents/
    ├── resources/
    └── docs/
```

El bundle `egm/` se guarda fuera del proyecto para sobrevivir a los cambios del proyecto. Su ruta absoluta se escribe en los prompts de los agentes generados. No muevas el directorio de instalación sin reinstalar.

## Verificar la instalación

```sh
opencode debug agents
```

La salida debe incluir `egm`, los ocho revisores `egm-*`, `egm-explorer` y `egm-bootstrap-worker`. Para una instalación local al proyecto, ejecuta el comando desde el directorio del proyecto.

Los tests del instalador corren offline:

```sh
npm test
```

### Estado de verificación

Probado en Windows 11 con OpenCode `2.2.7`:

- `opencode debug agents` descubre `egm`, los ocho revisores, `egm-explorer` y `egm-bootstrap-worker`.
- El agente `egm` cargó la skill `egm-drift-report` con la herramienta `skill`.
- El agente `egm` lanzó `egm-zoom-out` con la herramienta `subagent` y recibió su respuesta.
- Una revisión real de `egm-zoom-out` leyó el documento objetivo y el estándar Zoom Out, y devolvió hallazgos ordenados por severidad.
- Los tests offline del instalador pasan.

El flujo completo de cinco etapas de `/egm-review` no se ejecutó de punta a punta en el registro de pruebas de este repositorio. Ese es el siguiente paso de verificación antes de confiar en él para una revisión de diseño crítica.

## Límites de aislamiento y seguridad

- Una sesión hija fresca no es un sandbox. Los revisores están restringidos por permisos de OpenCode, no por el sistema operativo.
- Los revisores deniegan `grep` porque grep se compara contra la expresión de búsqueda, no contra la ruta del archivo, y podría saltarse las reglas de lectura de `.env`. El Elephant sí puede usar grep; trata las reglas de `.env` como una barrera, no como un límite de seguridad.
- OpenCode puede incluir archivos de instrucciones del proyecto o del usuario en las sesiones hijas. Contexto fresco significa que la conversación anterior no se pasa; no garantiza que las instrucciones del host queden excluidas.
- Las rutas fuera del proyecto están bloqueadas para los revisores por defecto. Si el documento objetivo vive fuera del proyecto, muévelo dentro o agrega un permiso `external_directory` para ese directorio. Los revisores siempre pueden leer el bundle `egm/` instalado.
- Los workers paralelos de bootstrap dependen de subagentes anidados. El flujo secuencial de bootstrap es la ruta soportada; el modo paralelo se instala pero depende del host.
- Los comandos son flujos de diseño. Producen documentos de diseño y código ilustrativo, no implementación de producción.

## Diferencias con el adaptador oficial de OpenCode

El repositorio de upstream incluye un adaptador **experimental para OpenCode V1** (`adapters/opencode/install.py`). Apunta a OpenCode `1.18.29`, usa `task` / `permission`, requiere Python y symlinks POSIX, y todavía no figura como harness soportado.

Este adaptador es distinto:

| Adaptador V1 de upstream | Este adaptador |
| --- | --- |
| OpenCode V1 (`task`, `permission`) | OpenCode V2 (`subagent`, `permissions`) |
| Python 3.10+ | Node.js 18+ |
| Symlinks POSIX | Copias de archivos; funciona en Windows |
| Bundle candidato con `OPENCODE_CONFIG` | Archivos globales o locales al proyecto, autodescubiertos |
| 8 revisores, sin explorador ni worker | 8 revisores + explorador + worker de bootstrap |

## Estructura del repositorio

```text
.
├── bin/egm-opencode.mjs      # CLI
├── src/                      # instalador, planificador, prompts, permisos
├── vendor/egm/               # contenido EGM de upstream, fijado
├── test/                     # tests offline del instalador
├── README.md
├── README.es.md
├── LICENSE
└── NOTICE
```

## Licencia y atribución

Este proyecto está bajo la **Licencia Apache 2.0**. Consulta [LICENSE](LICENSE) y [NOTICE](NOTICE).

Los archivos bajo `vendor/egm/` derivan del [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model), Copyright 2026 Google LLC, bajo Apache 2.0. El commit de upstream está registrado en [`vendor/egm/UPSTREAM.json`](vendor/egm/UPSTREAM.json).

Este es un adaptador comunitario no oficial. No está afiliado a Google y **no es un producto oficialmente soportado por Google**. EGM tampoco se describe upstream como un producto oficialmente soportado por Google.

## Créditos

- [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model) y [egm.dev](https://egm.dev), de Google y los contribuidores de EGM.
- El ensayo original de Dave Rensin, [Elephants, Goldfish, and the New Golden Age of Software Engineering](https://medium.com/@drensin/elephants-goldfish-and-the-new-golden-age-of-software-engineering-c33641a48874).
- [OpenCode](https://opencode.ai) por las interfaces de agentes, skills, comandos y subagentes.
