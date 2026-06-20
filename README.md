Proyecto: Movimiento Parabólico

Este proyecto es una simulación web interactiva basada en el clásico problema de cinemática conocido como el **"Experimento del mono y el cazador"** (o proyectil). En esta versión temática, visualizamos el lanzamiento de un *Kienzan* por parte de Krillin hacia un *Ozaru* en caída libre.

El objetivo principal de la simulación es demostrar que si un proyectil se apunta directamente a un objetivo suspendido, y el objetivo se deja caer en el instante exacto en que se dispara el proyectil, **siempre colisionarán** (asumiendo que el proyectil tiene suficiente alcance para llegar a la línea de caída del objetivo antes de tocar el suelo), sin importar la velocidad inicial del proyectil.

Tecnologías Usadas

El proyecto está construido completamente con tecnologías web estándar, sin dependencias ni librerías externas:

* **HTML5:** Estructura semántica de la interfaz y uso de etiquetas `<svg>` para dibujar las trayectorias parabólicas en tiempo real.
* **CSS3:** Diseño moderno con un esquema de colores neón/oscuro (Dark Mode). Hace uso intensivo de **CSS Grid** y **Flexbox** para el diseño responsivo, **Custom Properties (Variables)** para los temas de color, y **Animaciones Keyframes** para los efectos de impacto y rotación.
* **Vanilla JavaScript (ES6+):** Motor físico y de renderizado de la simulación. Maneja el bucle de animación con `requestAnimationFrame`, la lectura de variables del DOM, y los cálculos de cinemática frame a frame.

Conceptos Físicos Clave

1.  **Movimiento Parabólico (Proyectil):** El disco (Kienzan) experimenta un movimiento bidimensional. Un movimiento uniforme (velocidad constante) en el eje horizontal ($x$) y un movimiento uniformemente acelerado en el eje vertical ($y$) debido a la gravedad.
2.  **Caída Libre (Objetivo):** El Ozaru solo experimenta movimiento en el eje vertical ($y$), acelerando hacia abajo a $9.81 m/s^2$ desde el reposo.
3.  **Independencia de Movimientos:** El principio de Galileo demuestra que el movimiento horizontal del proyectil no afecta su movimiento vertical. Ambos objetos caen bajo la misma aceleración gravitatoria al mismo tiempo.

Fórmulas y Cálculos Matemáticos

Toda la lógica matemática reside en `script.js`. Aquí se explican las ecuaciones utilizadas para calcular la simulación:

### 1. Cálculo del Ángulo de Tiro Automático
Para que el proyectil apunte exactamente al objetivo inicial, se calcula el ángulo usando la arcotangente de las diferencias de altura y distancia:
