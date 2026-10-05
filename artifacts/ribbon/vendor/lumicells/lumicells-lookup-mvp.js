// artifacts/ribbon/vendor/lumicells/src/schema/fields.ts
function num(o) {
  return { ...o, kind: "number", live: o.live ?? "uniform", gpu: o.gpu ?? false };
}
function int(o) {
  return { ...o, kind: "int", live: o.live ?? "uniform", gpu: o.gpu ?? false };
}
function angle(o) {
  const min = o.min ?? 0;
  const max = o.max ?? 360;
  return {
    ...o,
    kind: "angle",
    min,
    max,
    step: o.step ?? 1,
    unit: "\xB0",
    fullCircle: max - min >= 360,
    live: o.live ?? "uniform",
    gpu: o.gpu ?? false
  };
}
function bool(o) {
  return { ...o, kind: "boolean", live: o.live ?? "uniform", gpu: o.gpu ?? false };
}
function color(o) {
  return { ...o, kind: "color", live: o.live ?? "uniform", gpu: o.gpu ?? false };
}
function vec2(o) {
  return { ...o, kind: "vec2", live: o.live ?? "uniform", gpu: o.gpu ?? false };
}
function enumField(o) {
  return {
    ...o,
    kind: "enum",
    transition: o.transition ?? "instant",
    live: o.live ?? "uniform",
    gpu: o.gpu ?? false
  };
}
function palette(o) {
  return {
    ...o,
    kind: "palette",
    minStops: o.minStops ?? 1,
    maxStops: o.maxStops ?? 32,
    live: o.live ?? "lut",
    gpu: o.gpu ?? false
  };
}
function group(meta, fields) {
  const { kind, ...rest } = meta;
  const g = { ...rest, kind: "group", fields };
  if (kind === "mode") g.role = "mode";
  return g;
}
function isGroup(node) {
  return node?.kind === "group";
}

// artifacts/ribbon/vendor/lumicells/src/schema/schema.ts
var grid = group(
  {
    label: "Grid",
    order: 10,
    description: "Size and shape of the pixel-grid cells."
  },
  {
    sizing: enumField({
      values: ["pitch", "count"],
      default: "count",
      label: "Cell sizing",
      description: "Size the grid by a fixed pitch in pixels or by the number of cells along the shorter side of the container.",
      labels: { pitch: "Pitch in px", count: "Cell count" },
      live: "realloc"
    }),
    pitch: num({
      min: 4,
      max: 96,
      step: 1,
      unit: "px",
      default: 24,
      label: "Pitch",
      description: "Distance between the centers of neighboring cells, in CSS pixels.",
      live: "realloc",
      visibleWhen: { path: "grid.sizing", eq: "pitch" }
    }),
    count: int({
      min: 8,
      max: 200,
      step: 1,
      default: 31,
      label: "Cells",
      description: "How many cells fit along the shorter side of the container, so the composition looks the same in a square, a banner or full screen.",
      live: "realloc",
      visibleWhen: { path: "grid.sizing", eq: "count" }
    }),
    gap: num({
      min: 0.02,
      max: 0.6,
      step: 0.01,
      default: 0.27,
      label: "Gap",
      description: "Fraction of the pitch taken by the dark gap between cells.",
      gpu: true
    }),
    roundness: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      label: "Roundness",
      description: "Corner radius as a fraction of half a cell: 0 is a square, 1 is a circle.",
      gpu: true
    }),
    softness: num({
      min: 0,
      max: 3,
      step: 0.05,
      unit: "px",
      default: 0.6,
      label: "Edge softness",
      description: "Feathering of the cell edge, in device pixels.",
      gpu: true
    }),
    emitter: num({
      min: 0,
      max: 0.6,
      step: 0.01,
      default: 0.18,
      label: "Emitter",
      description: "How much brighter the center of a cell is than its edges.",
      gpu: true
    }),
    bevel: num({
      min: 0,
      max: 0.15,
      step: 0.01,
      default: 0,
      label: "Bevel",
      description: "Subtle depth: a light top edge and a dark bottom edge on each cell.",
      gpu: true,
      advanced: true
    })
  }
);
var scene = group(
  {
    label: "Composition",
    order: 20,
    description: "Position and scale of the whole picture inside the container."
  },
  {
    center: vec2({
      min: -1,
      max: 1,
      step: 0.01,
      default: [-0.02, -0.02],
      label: "Center",
      description: "Composition center in mode units (1 = half of the shorter side).",
      gpu: true
    }),
    zoom: num({
      min: 0.25,
      max: 4,
      step: 0.01,
      scale: "log",
      default: 1,
      label: "Zoom",
      description: "Magnifies all modes around the center.",
      gpu: true
    })
  }
);
var animation = group(
  {
    label: "Animation",
    order: 30,
    description: "Global speed, mode blending and cell liveliness."
  },
  {
    speed: num({
      min: 0,
      max: 4,
      step: 0.01,
      default: 1,
      label: "Speed",
      description: "Global time multiplier for all modes."
    }),
    blend: enumField({
      values: ["screen", "add", "max"],
      default: "screen",
      label: "Mode blending",
      description: "How several active modes are combined.",
      labels: { screen: "Screen", add: "Add", max: "Max" },
      gpu: true
    }),
    brightness: num({
      min: 0,
      max: 3,
      step: 0.01,
      default: 1,
      label: "Brightness",
      description: "Cell intensity multiplier.",
      gpu: true
    }),
    gamma: num({
      min: 0.3,
      max: 3,
      step: 0.01,
      default: 1.15,
      label: "Contrast (gamma)",
      description: "Values above 1 darken the midtones and increase contrast.",
      gpu: true
    }),
    floor: num({
      min: 0,
      max: 0.5,
      step: 0.01,
      default: 0.16,
      label: "Unlit visibility",
      description: "How visible the unlit cells are.",
      gpu: true
    }),
    energy: num({
      min: 0,
      max: 3,
      step: 0.01,
      default: 1,
      label: "Energy",
      description: "External drive: handy for modulating with audio or events.",
      gpu: true
    }),
    flicker: group(
      { label: "Flicker", description: "Slow random brightness breathing of each cell." },
      {
        amount: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.4,
          label: "Amount",
          description: "Flicker amplitude.",
          gpu: true
        }),
        rate: num({
          min: 0.05,
          max: 5,
          step: 0.01,
          unit: "Hz",
          default: 0.3,
          label: "Rate",
          description: "How fast the brightness changes.",
          gpu: true
        })
      }
    ),
    sparkle: group(
      { label: "Sparkle", description: "Rare short flashes of individual cells." },
      {
        amount: num({
          min: 0,
          max: 2,
          step: 0.01,
          default: 0.35,
          label: "Amount",
          description: "Brightness added during a flash.",
          gpu: true
        }),
        rate: num({
          min: 0,
          max: 0.05,
          step: 1e-3,
          default: 8e-3,
          label: "Rate",
          description: "Flash probability per cell per second.",
          gpu: true
        }),
        duration: num({
          min: 0.1,
          max: 2,
          step: 0.01,
          unit: "s",
          default: 0.5,
          label: "Duration",
          description: "Length of a single flash.",
          gpu: true
        })
      }
    ),
    sparsity: group(
      {
        label: "Sparsity",
        description: "On the outskirts cells switch off entirely instead of dimming."
      },
      {
        amount: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.55,
          label: "Amount",
          description: "Share of switched-off cells in weak areas.",
          gpu: true
        }),
        period: num({
          min: 0.5,
          max: 10,
          step: 0.1,
          unit: "s",
          default: 3,
          label: "Period",
          description: "How often the switched-off cells are reshuffled.",
          gpu: true
        })
      }
    )
  }
);
var weight = (value, label = "Weight") => num({
  min: 0,
  max: 1,
  step: 0.01,
  default: value,
  label,
  description: "Contribution of the mode to the final image; 0 turns the mode off.",
  gpu: true
});
var modes = group(
  {
    label: "Animation modes",
    order: 40,
    description: "Layers of the brightness field; several modes can be mixed at once."
  },
  {
    flow: group(
      { label: "Flow", kind: "mode", description: "A smoothly flowing noise pattern." },
      {
        weight: weight(0.1),
        scale: num({
          min: 0.2,
          max: 8,
          step: 0.01,
          scale: "log",
          default: 1.6,
          label: "Scale",
          description: "Noise frequency: higher values give smaller blobs.",
          gpu: true
        }),
        speed: num({
          min: 0,
          max: 3,
          step: 0.01,
          default: 0.25,
          label: "Speed",
          description: "How fast the pattern flows."
        }),
        direction: angle({
          default: 30,
          label: "Direction",
          description: "Where the pattern flows.",
          gpu: true
        }),
        threshold: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.45,
          label: "Threshold",
          description: "Higher values leave fewer glowing blobs.",
          gpu: true
        }),
        softness: num({
          min: 0.02,
          max: 1,
          step: 0.01,
          default: 0.3,
          label: "Softness",
          description: "Width of the transition from dark to light.",
          gpu: true
        })
      }
    ),
    sphere: group(
      {
        label: "Sphere",
        kind: "mode",
        description: "A glowing hollow orb with a rim and a soft fade."
      },
      {
        weight: weight(1),
        radius: num({
          min: 0.1,
          max: 1.6,
          step: 0.01,
          default: 0.68,
          label: "Radius",
          description: "Sphere radius in mode units.",
          gpu: true
        }),
        shift: vec2({
          min: -1,
          max: 1,
          step: 0.01,
          default: [0.02, 0.16],
          label: "Shell offset",
          description: "Offset of the glowing shell relative to the hole: the ring is thicker and denser on that side while the hole stays centered.",
          gpu: true
        }),
        hole: num({
          min: 0,
          max: 0.9,
          step: 0.01,
          default: 0.25,
          label: "Hole",
          description: "Radius of the dark middle; 0 gives a solid orb.",
          gpu: true
        }),
        holeSoftness: num({
          min: 0.01,
          max: 0.5,
          step: 0.01,
          default: 0.12,
          label: "Hole softness",
          description: "Width of the transition from the hole to the bright ring.",
          gpu: true
        }),
        rimPower: num({
          min: 0.3,
          max: 6,
          step: 0.01,
          default: 1.3,
          label: "Rim",
          description: "Higher values push the light toward the edge of the sphere.",
          gpu: true
        }),
        outerFalloff: num({
          min: 0.05,
          max: 1.5,
          step: 0.01,
          default: 0.38,
          label: "Outer falloff",
          description: "How far the light reaches beyond the sphere radius.",
          gpu: true
        }),
        lightAngle: angle({
          default: 200,
          label: "Light direction",
          description: "Which side of the sphere is lit more strongly.",
          gpu: true
        }),
        lightStrength: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.45,
          label: "Light strength",
          description: "Contrast between the lit side and the shadow side.",
          gpu: true
        }),
        rotationSpeed: num({
          min: -2,
          max: 2,
          step: 0.01,
          default: 0.12,
          label: "Rotation",
          description: "Rotation speed of the sphere surface (the sign sets the direction)."
        }),
        tilt: angle({
          min: -60,
          max: 60,
          default: 20,
          label: "Axis tilt",
          description: "Tilt of the rotation axis.",
          gpu: true
        }),
        surface: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.55,
          label: "Surface",
          description: "Strength of the pattern on the sphere surface.",
          gpu: true
        }),
        surfaceScale: num({
          min: 0.5,
          max: 8,
          step: 0.01,
          default: 2.5,
          label: "Surface scale",
          description: "Frequency of the surface pattern.",
          gpu: true
        }),
        wobble: num({
          min: 0,
          max: 0.3,
          step: 5e-3,
          default: 0.08,
          label: "Wobble",
          description: "Noise distortion of the sphere outline.",
          gpu: true
        }),
        breathe: num({
          min: 0,
          max: 0.2,
          step: 5e-3,
          default: 0.025,
          label: "Breathing",
          description: "Amplitude of the radius pulsation.",
          gpu: true
        }),
        breatheSpeed: num({
          min: 0,
          max: 3,
          step: 0.01,
          default: 0.35,
          label: "Breathing rate",
          description: "Frequency of the radius pulsation."
        }),
        fadeAngle: angle({
          default: 345,
          label: "Fade side",
          description: "Direction in which the sphere dissolves into the background.",
          gpu: true
        }),
        fadeAmount: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 1,
          label: "Fade amount",
          description: "How strongly the fade side dims.",
          gpu: true
        })
      }
    ),
    pulse: group(
      { label: "Pulse", kind: "mode", description: "Concentric rings spreading from the center." },
      {
        weight: weight(0),
        speed: num({
          min: 0,
          max: 3,
          step: 0.01,
          default: 0.45,
          label: "Speed",
          description: "How fast the rings expand."
        }),
        frequency: num({
          min: 0.5,
          max: 12,
          step: 0.01,
          default: 3,
          label: "Frequency",
          description: "Rings per mode unit.",
          gpu: true
        }),
        width: num({
          min: 0.02,
          max: 0.6,
          step: 0.01,
          default: 0.14,
          label: "Width",
          description: "Ring thickness.",
          gpu: true
        }),
        breathe: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.35,
          label: "Breathing",
          description: "Overall brightness pulsation.",
          gpu: true
        }),
        falloff: num({
          min: 0,
          max: 3,
          step: 0.01,
          default: 1,
          label: "Falloff",
          description: "How fast the rings fade with distance.",
          gpu: true
        }),
        origin: vec2({
          min: -1,
          max: 1,
          step: 0.01,
          default: [0, 0],
          label: "Origin",
          description: "Ring center relative to the composition center.",
          gpu: true
        })
      }
    ),
    wave: group(
      { label: "Waves", kind: "mode", description: "Traveling plane waves with interference." },
      {
        weight: weight(0),
        angle: angle({
          default: 20,
          label: "Direction",
          description: "Direction in which the waves travel.",
          gpu: true
        }),
        frequency: num({
          min: 0.2,
          max: 12,
          step: 0.01,
          default: 2.5,
          label: "Frequency",
          description: "Crests per mode unit.",
          gpu: true
        }),
        speed: num({
          min: 0,
          max: 3,
          step: 0.01,
          default: 0.5,
          label: "Speed",
          description: "How fast the waves travel."
        }),
        sharpness: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.35,
          label: "Sharpness",
          description: "Higher values give narrow bright crests.",
          gpu: true
        }),
        interference: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.5,
          label: "Interference",
          description: "Mix of a second wave at a different angle.",
          gpu: true
        })
      }
    ),
    ripple: group(
      { label: "Ripples", kind: "mode", description: "Random rings, like drops falling on water." },
      {
        weight: weight(0),
        rate: num({
          min: 0,
          max: 6,
          step: 0.01,
          unit: "/s",
          default: 1.2,
          label: "Rate",
          description: "How many drops appear per second.",
          gpu: true
        }),
        speed: num({
          min: 0.05,
          max: 2,
          step: 0.01,
          default: 0.4,
          label: "Speed",
          description: "How fast a ring expands.",
          gpu: true
        }),
        width: num({
          min: 0.02,
          max: 0.4,
          step: 0.01,
          default: 0.09,
          label: "Width",
          description: "Ring thickness.",
          gpu: true
        }),
        life: num({
          min: 0.5,
          max: 6,
          step: 0.1,
          unit: "s",
          default: 2.5,
          label: "Lifetime",
          description: "How long a single ring lives.",
          gpu: true
        })
      }
    ),
    vortex: group(
      { label: "Vortex", kind: "mode", description: "Twisted spiral arms." },
      {
        weight: weight(0),
        arms: int({
          min: 1,
          max: 8,
          step: 1,
          default: 3,
          label: "Arms",
          description: "Number of spiral arms.",
          gpu: true
        }),
        twist: num({
          min: -10,
          max: 10,
          step: 0.1,
          default: 3,
          label: "Twist",
          description: "How tightly the arms are wound (the sign sets the direction).",
          gpu: true
        }),
        speed: num({
          min: -3,
          max: 3,
          step: 0.01,
          default: 0.3,
          label: "Speed",
          description: "Rotation speed of the vortex."
        }),
        falloff: num({
          min: 0,
          max: 3,
          step: 0.01,
          default: 0.9,
          label: "Falloff",
          description: "How fast the vortex fades away from the center.",
          gpu: true
        }),
        sharpness: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.4,
          label: "Sharpness",
          description: "Crispness of the arm edges.",
          gpu: true
        })
      }
    ),
    life: group(
      {
        label: "Life",
        kind: "mode",
        description: "A cellular automaton in the spirit of Conway's Game of Life."
      },
      {
        weight: weight(0),
        stepRate: num({
          min: 1,
          max: 30,
          step: 0.1,
          unit: "Hz",
          default: 8,
          label: "Steps per second",
          description: "Evolution speed of the automaton."
        }),
        birthRate: num({
          min: 0,
          max: 0.05,
          step: 5e-4,
          default: 4e-3,
          label: "Spontaneous births",
          description: "Chance of a random cell birth per step; keeps the field from dying out."
        }),
        fadeSteps: int({
          min: 1,
          max: 16,
          step: 1,
          default: 4,
          label: "Fade",
          description: "How many steps a dead cell takes to fade out.",
          gpu: true
        }),
        seedDensity: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.3,
          label: "Seed density",
          description: "Share of live cells after a reset."
        }),
        rule: enumField({
          values: ["conway", "highlife", "daynight", "seeds"],
          default: "conway",
          label: "Rule",
          description: "Birth and survival rule; changing it restarts the field.",
          labels: {
            conway: "Conway B3/S23",
            highlife: "HighLife B36/S23",
            daynight: "Day & Night",
            seeds: "Seeds B2/S"
          },
          live: "restart"
        })
      }
    ),
    rain: group(
      { label: "Rain", kind: "mode", description: "Falling glowing drops with a trail." },
      {
        weight: weight(0),
        speed: num({
          min: 0.1,
          max: 5,
          step: 0.01,
          default: 1,
          label: "Speed",
          description: "How fast the drops fall."
        }),
        density: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.25,
          label: "Density",
          description: "Share of columns with rain.",
          gpu: true
        }),
        tail: num({
          min: 0.05,
          max: 1.5,
          step: 0.01,
          default: 0.5,
          label: "Trail",
          description: "Length of the glowing trail behind a drop.",
          gpu: true
        }),
        angle: angle({
          min: -45,
          max: 45,
          default: 0,
          label: "Slant",
          description: "Deviation of the rain from vertical.",
          gpu: true
        })
      }
    )
  }
);
var colorGroup = group(
  {
    label: "Color",
    order: 50,
    description: "The palette and how it is laid over the grid."
  },
  {
    palette: palette({
      default: [
        "#a0206a",
        "#f21239",
        "#e0267a",
        "#5a44d0",
        "#2a55e0",
        "#1f5fe8",
        "#0870f8",
        "#0476ff",
        "#0a84f2",
        "#0a8cf0",
        "#0a78e8",
        "#0b5ccc"
      ],
      minStops: 1,
      maxStops: 32,
      label: "Palette",
      description: "Gradient color stops, from start to end."
    }),
    interpolation: enumField({
      values: ["oklab", "linear", "steps"],
      default: "oklab",
      label: "Interpolation",
      description: "How neighboring palette colors are blended.",
      labels: { oklab: "OKLab (smooth)", linear: "Linear (RGB)", steps: "Steps" },
      live: "lut"
    }),
    mapping: enumField({
      values: ["spatial", "radial", "angular", "intensity", "noise"],
      default: "spatial",
      label: "Mapping",
      description: "What sets the position of a cell on the palette.",
      labels: {
        spatial: "Along axis",
        radial: "Radial",
        angular: "Angular",
        intensity: "By brightness",
        noise: "Noise"
      },
      transition: "crossfade",
      gpu: true
    }),
    angle: angle({
      default: 22,
      label: "Axis angle",
      description: "Direction from the start of the palette to its end (axis mapping).",
      gpu: true
    }),
    bend: num({
      min: -1,
      max: 1,
      step: 0.01,
      default: 0.35,
      label: "Axis bend",
      description: "Bends the color boundaries into arcs around the center (axis mapping): the start color gathers into a crescent on one side.",
      gpu: true
    }),
    scale: num({
      min: 0.1,
      max: 4,
      step: 0.01,
      scale: "log",
      default: 1,
      label: "Stretch",
      description: "Higher values repeat the palette more often.",
      gpu: true
    }),
    offset: num({
      min: -1,
      max: 1,
      step: 0.01,
      default: 0,
      label: "Offset",
      description: "Shifts the palette along the mapping.",
      gpu: true
    }),
    warp: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.12,
      label: "Warp",
      description: "Noise distortion of the color boundaries.",
      gpu: true
    }),
    warpScale: num({
      min: 0.2,
      max: 6,
      step: 0.01,
      default: 1.3,
      label: "Warp scale",
      description: "Frequency of the warp noise.",
      gpu: true
    }),
    jitter: num({
      min: 0,
      max: 0.5,
      step: 0.01,
      default: 0.12,
      label: "Jitter",
      description: "Random color offset of each cell.",
      gpu: true
    }),
    intensityShift: num({
      min: -1,
      max: 1,
      step: 0.01,
      default: 0.12,
      label: "Brightness shift",
      description: "Bright cells move along the palette.",
      gpu: true
    }),
    drift: num({
      min: -0.5,
      max: 0.5,
      step: 1e-3,
      default: 0,
      label: "Drift",
      description: "Palette scrolling, in cycles per second."
    }),
    saturation: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.05,
      label: "Saturation",
      description: "Saturation of the cell colors.",
      gpu: true
    }),
    hot: group(
      {
        label: "Hot core",
        description: "The brightest cells turn lighter in a tint of their own color."
      },
      {
        amount: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.15,
          label: "Amount",
          description: "How much the bright cells lighten.",
          gpu: true
        }),
        threshold: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.92,
          label: "Threshold",
          description: "Brightness at which the hot core starts.",
          gpu: true
        }),
        core: num({
          min: 0.1,
          max: 1,
          step: 0.01,
          default: 0.8,
          label: "Core",
          description: "Size of the hot middle of a cell.",
          gpu: true
        })
      }
    ),
    accent: group(
      {
        label: "Accent",
        description: "Organic patches of a second color on the inner edge of the sphere, only in the cool half of the palette (teal within blue)."
      },
      {
        color: color({
          default: "#12c0d8",
          label: "Color",
          description: "Color of the accent patches.",
          gpu: true
        }),
        amount: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.9,
          label: "Amount",
          description: "How strongly the patches take the accent color; 0 turns it off.",
          gpu: true
        })
      }
    )
  }
);
var spot = (label, c, position, radius, strength) => group(
  { label, description: "A soft color spot on the background." },
  {
    color: color({ default: c, label: "Color", description: "Spot color.", gpu: true }),
    position: vec2({
      min: -2,
      max: 2,
      step: 0.01,
      default: position,
      label: "Position",
      description: "Spot center in mode units.",
      gpu: true
    }),
    radius: num({
      min: 0.1,
      max: 4,
      step: 0.01,
      default: radius,
      label: "Radius",
      description: "Spot size.",
      gpu: true
    }),
    strength: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: strength,
      label: "Strength",
      description: "Spot brightness.",
      gpu: true
    })
  }
);
var background = group(
  {
    label: "Background",
    order: 60,
    description: "The backdrop under the grid: color, vignette and color spots."
  },
  {
    color: color({
      default: "#000032",
      label: "Color",
      description: "Main background color.",
      gpu: true
    }),
    vignette: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.35,
      label: "Vignette",
      description: "Darkens the background corners (the cells are not affected).",
      gpu: true
    }),
    spotA: spot("Spot A", "#6a1f6e", [-1.3, -0.2], 1.25, 0.65),
    spotB: spot("Spot B", "#16207e", [-0.8, 1.1], 0.9, 0.5)
  }
);
var glow = group(
  {
    label: "Glow",
    order: 70,
    description: "Halo around the cells, bloom and atmospheric haze."
  },
  {
    halo: group(
      { label: "Halo", description: "Dense glow in the gaps around the cells." },
      {
        strength: num({
          min: 0,
          max: 2,
          step: 0.01,
          default: 0.5,
          label: "Strength",
          description: "Halo brightness.",
          gpu: true
        }),
        radius: num({
          min: 0.02,
          max: 0.5,
          step: 0.01,
          unit: "cells",
          default: 0.18,
          label: "Radius",
          description: "How far the halo reaches into the gap.",
          gpu: true
        })
      }
    ),
    bloom: group(
      { label: "Bloom", description: "Soft glow of the bright areas." },
      {
        strength: num({
          min: 0,
          max: 2,
          step: 0.01,
          default: 0.8,
          label: "Strength",
          description: "Bloom brightness.",
          gpu: true
        }),
        radius: num({
          min: 0.5,
          max: 3,
          step: 0.05,
          unit: "cells",
          default: 1.3,
          label: "Radius",
          description: "Bloom blur width, in cells."
        }),
        threshold: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.35,
          label: "Threshold",
          description: "Brightness at which a cell starts to glow.",
          gpu: true
        }),
        knee: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.5,
          label: "Threshold knee",
          description: "Softness of the transition through the threshold.",
          gpu: true
        })
      }
    ),
    haze: group(
      { label: "Haze", description: "Wide atmospheric glow." },
      {
        strength: num({
          min: 0,
          max: 1,
          step: 0.01,
          default: 0.12,
          label: "Strength",
          description: "Haze brightness.",
          gpu: true
        }),
        radius: num({
          min: 2,
          max: 12,
          step: 0.1,
          unit: "cells",
          default: 4,
          label: "Radius",
          description: "Haze blur width, in cells."
        })
      }
    ),
    saturation: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 1.15,
      label: "Glow saturation",
      description: "Saturation of the halo, bloom and haze.",
      gpu: true
    }),
    exposure: num({
      min: 0.2,
      max: 4,
      step: 0.01,
      scale: "log",
      default: 1,
      label: "Exposure",
      description: "Overall brightness before tone mapping.",
      gpu: true
    }),
    whitePoint: num({
      min: 1,
      max: 16,
      step: 0.1,
      default: 4,
      label: "White point",
      description: "Brightness that maps to white; higher values give softer highlights.",
      gpu: true
    })
  }
);
var whenFloat = { path: "lift.style", eq: "float" };
var lift = group(
  {
    label: "Lifted pixels",
    order: 80,
    description: "Individual cells rise above the grid and settle back."
  },
  {
    enabled: bool({
      default: true,
      label: "Enabled",
      description: "Show lifted pixels."
    }),
    style: enumField({
      values: ["pop", "float"],
      default: "pop",
      label: "Style",
      description: "Pop up in place or float upward like bubbles.",
      labels: { pop: "Pop", float: "Float" }
    }),
    amount: num({
      min: 0,
      max: 0.06,
      step: 1e-3,
      default: 0.016,
      label: "Amount",
      description: "Share of cells lifted at the same time."
    }),
    max: int({
      min: 0,
      max: 128,
      step: 1,
      default: 96,
      label: "Maximum",
      description: "Limit on simultaneously lifted cells.",
      live: "static"
    }),
    scale: num({
      min: 1,
      max: 2.5,
      step: 0.01,
      default: 1.5,
      label: "Scale",
      description: "How many times larger a lifted cell is."
    }),
    height: num({
      min: 0,
      max: 2,
      step: 0.01,
      unit: "cells",
      default: 0.35,
      label: "Height",
      description: "Upward offset while lifted."
    }),
    parallax: num({
      min: 0,
      max: 0.3,
      step: 0.01,
      default: 0.06,
      label: "Parallax",
      description: "Offset away from the center that adds a sense of depth."
    }),
    tilt: num({
      min: 0,
      max: 20,
      step: 0.5,
      unit: "\xB0",
      default: 6,
      label: "Tilt",
      description: "Random tilt of a lifted cell."
    }),
    holdMin: num({
      min: 0.2,
      max: 10,
      step: 0.1,
      unit: "s",
      default: 1.5,
      label: "Hold min",
      description: "Minimum time spent lifted."
    }),
    holdMax: num({
      min: 0.2,
      max: 10,
      step: 0.1,
      unit: "s",
      default: 3.5,
      label: "Hold max",
      description: "Maximum time spent lifted."
    }),
    rise: num({
      min: 0.1,
      max: 2,
      step: 0.01,
      unit: "s",
      default: 0.6,
      label: "Rise",
      description: "Rise duration (with a springy overshoot)."
    }),
    fall: num({
      min: 0.1,
      max: 2,
      step: 0.01,
      unit: "s",
      default: 0.45,
      label: "Fall",
      description: "Duration of the return to place."
    }),
    brightness: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 0.9,
      label: "Brightness",
      description: "Extra brightness of a lifted cell.",
      gpu: true
    }),
    whiten: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.12,
      label: "Whiten",
      description: "Shifts the color toward a lighter tint.",
      gpu: true
    }),
    bokeh: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      label: "Bokeh",
      description: "Share of lifted cells blurred as if out of focus."
    }),
    shadow: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      label: "Shadow",
      description: "Density of the shadow under a lifted cell.",
      gpu: true
    }),
    halo: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 0.8,
      label: "Halo",
      description: "Glow around a lifted cell.",
      gpu: true
    }),
    socket: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.6,
      label: "Socket",
      description: "How much the spot a cell rose from darkens."
    }),
    threshold: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.2,
      label: "Threshold",
      description: "Minimum cell brightness required to lift.",
      gpu: true
    }),
    outerBias: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.85,
      label: "Edge bias",
      description: "Prefer outer and dim areas."
    }),
    cluster: num({
      min: 0,
      max: 0.5,
      step: 0.01,
      default: 0.15,
      label: "Clusters",
      description: "Chance to lift neighboring cells together with a cell."
    }),
    landing: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.25,
      label: "Landing",
      description: "Strength of the ripple ring when a cell lands."
    }),
    floatSpeed: num({
      min: 0.1,
      max: 4,
      step: 0.01,
      unit: "cells/s",
      default: 0.9,
      label: "Float speed",
      description: "Rise speed in the Float style.",
      visibleWhen: whenFloat
    }),
    floatDrift: num({
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      label: "Drift",
      description: "Sideways sway while floating.",
      visibleWhen: whenFloat
    })
  }
);
var interaction = group(
  {
    label: "Interaction",
    order: 90,
    description: "Response to the pointer and clicks, and defaults for bound elements."
  },
  {
    pointer: bool({
      default: false,
      label: "Pointer",
      description: "Light up the cells under the pointer."
    }),
    pointerRadius: num({
      min: 1,
      max: 30,
      step: 0.5,
      unit: "cells",
      default: 4,
      label: "Pointer radius",
      description: "Size of the light spot around the pointer.",
      visibleWhen: { path: "interaction.pointer", eq: true }
    }),
    pointerStrength: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 0.6,
      label: "Pointer strength",
      description: "Brightness of the highlight under the pointer.",
      visibleWhen: { path: "interaction.pointer", eq: true }
    }),
    pointerLift: bool({
      default: true,
      label: "Lift on hover",
      description: "Lift cells under the pointer.",
      visibleWhen: { path: "interaction.pointer", eq: true }
    }),
    click: bool({
      default: true,
      label: "Click",
      description: "Start a ripple on click."
    }),
    rippleStrength: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 0.8,
      label: "Ripple strength",
      description: "Brightness of the click ripple.",
      visibleWhen: { path: "interaction.click", eq: true }
    }),
    rippleSpeed: num({
      min: 2,
      max: 60,
      step: 0.5,
      unit: "cells/s",
      default: 18,
      label: "Ripple speed",
      description: "How fast the ripple expands.",
      visibleWhen: { path: "interaction.click", eq: true }
    }),
    rippleWidth: num({
      min: 0.5,
      max: 6,
      step: 0.1,
      unit: "cells",
      default: 1.5,
      label: "Ripple width",
      description: "Thickness of the ripple ring.",
      visibleWhen: { path: "interaction.click", eq: true }
    }),
    influenceStrength: num({
      min: 0,
      max: 2,
      step: 0.01,
      default: 0.8,
      label: "Influence strength",
      description: "Default strength for bound elements (bindElement / addInfluence)."
    }),
    influenceFalloff: num({
      min: 0.2,
      max: 10,
      step: 0.1,
      unit: "cells",
      default: 2,
      label: "Influence falloff",
      description: "Default width of the soft edge of an influence."
    })
  }
);
var render = group(
  {
    label: "Performance",
    order: 100,
    advanced: true,
    description: "Quality, resolution and frame rate."
  },
  {
    quality: enumField({
      values: ["auto", "high", "medium", "low"],
      default: "auto",
      label: "Quality",
      description: '"Auto" lowers the quality when the device cannot keep up.',
      labels: { auto: "Auto", high: "High", medium: "Medium", low: "Low" },
      live: "static"
    }),
    maxDpr: num({
      min: 0.5,
      max: 3,
      step: 0.05,
      default: 2,
      label: "Max DPR",
      description: "Upper limit of the canvas pixel density.",
      live: "static"
    }),
    maxPixels: num({
      min: 0.3,
      max: 12,
      step: 0.1,
      unit: "MP",
      default: 4.2,
      label: "Max pixels",
      description: "Upper limit of the canvas size; phones are capped at 2.4 MP.",
      live: "static"
    }),
    overflow: num({
      min: 0,
      max: 300,
      step: 1,
      unit: "px",
      default: 0,
      label: "Overflow",
      description: "The canvas extends past the container so the glow is not clipped.",
      live: "static"
    }),
    maxFps: int({
      min: 0,
      max: 240,
      step: 1,
      default: 0,
      label: "Max FPS",
      description: "0 follows the display rate; otherwise an integer divisor of the refresh rate.",
      live: "static"
    }),
    pauseOffscreen: bool({
      default: true,
      label: "Pause offscreen",
      description: "Stop rendering while the background is not visible.",
      live: "static"
    }),
    reducedMotion: enumField({
      values: ["respect", "ignore"],
      default: "respect",
      label: "Reduced motion",
      description: "Whether to honor the system prefers-reduced-motion setting.",
      labels: { respect: "Respect", ignore: "Ignore" },
      live: "static"
    })
  }
);
var transition = num({
  min: 0,
  max: 5e3,
  step: 10,
  unit: "ms",
  default: 600,
  label: "Transition",
  description: "Duration of the smooth transition when settings change.",
  live: "static"
});
var schema = group(
  { label: "LumiCells" },
  {
    grid,
    scene,
    animation,
    modes,
    color: colorGroup,
    background,
    glow,
    lift,
    interaction,
    render,
    transition
  }
);
var CONFIG_VERSION = 1;
var MODE_IDS = [
  "flow",
  "sphere",
  "pulse",
  "wave",
  "ripple",
  "vortex",
  "life",
  "rain"
];

// artifacts/ribbon/vendor/lumicells/src/schema/defaults.ts
function build(g) {
  const out = {};
  for (const key of Object.keys(g.fields)) {
    const node = g.fields[key];
    if (!node) continue;
    if (isGroup(node)) out[key] = build(node);
    else out[key] = Array.isArray(node.default) ? node.default.slice() : node.default;
  }
  return out;
}
function getDefaults() {
  return { version: CONFIG_VERSION, ...build(schema) };
}

// artifacts/ribbon/vendor/lumicells/src/core/color.ts
var HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function isHexColor(value) {
  return typeof value === "string" && HEX_RE.test(value.trim());
}
function hexToRgb(hex) {
  const m = HEX_RE.exec(hex.trim());
  if (!m?.[1]) return [0, 0, 0];
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = Number.parseInt(h, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function rgbToHex([r, g, b]) {
  const to = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function normalizeHex(hex) {
  return rgbToHex(hexToRgb(hex));
}
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// artifacts/ribbon/vendor/lumicells/src/schema/paths.ts
function walkSchema(visitor, root = schema) {
  const parents = [];
  const visit = (g, prefix) => {
    parents.push(g);
    for (const key of Object.keys(g.fields)) {
      const node = g.fields[key];
      const path = prefix ? `${prefix}.${key}` : key;
      const r = visitor(node, path, parents.slice());
      if (isGroup(node) && r !== false) visit(node, path);
    }
    parents.pop();
  };
  visit(root, "");
}
var leafCache = null;
function leaves() {
  if (!leafCache) {
    const paths = [];
    const fields = /* @__PURE__ */ new Map();
    walkSchema((node, path) => {
      if (!isGroup(node)) {
        paths.push(path);
        fields.set(path, node);
      }
    });
    leafCache = { paths, fields };
  }
  return leafCache;
}
function getLeafPaths() {
  return leaves().paths;
}
function getField(path) {
  return leaves().fields.get(path);
}
function isPlainObject(v) {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
function getPath(cfg, path) {
  let cur = cfg;
  for (const key of path.split(".")) {
    if (!isPlainObject(cur) || !Object.hasOwn(cur, key)) return void 0;
    cur = cur[key];
  }
  return cur;
}
function valueEquals(a, b) {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!valueEquals(a[i], b[i])) return false;
    return true;
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => Object.hasOwn(b, k) && valueEquals(a[k], b[k]));
  }
  return false;
}
function diffConfigs(a, b) {
  const out = [];
  for (const p of getLeafPaths()) {
    if (!valueEquals(getPath(a, p), getPath(b, p))) out.push(p);
  }
  return out;
}
function cloneData(v) {
  if (Array.isArray(v)) return v.map(cloneData);
  if (isPlainObject(v)) {
    const o = {};
    for (const k of Object.keys(v)) o[k] = cloneData(v[k]);
    return o;
  }
  return v;
}
function deepMerge(base, patch) {
  if (patch === void 0) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return cloneData(patch);
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    if (pv === void 0) continue;
    out[k] = deepMerge(out[k], pv);
  }
  return out;
}

// artifacts/ribbon/vendor/lumicells/src/schema/presets.ts
var PRESET_IDS = [
  "reference",
  "orb",
  "pulse",
  "life",
  "vortex",
  "waves",
  "ripples",
  "rain",
  "minimal"
];
var PRESETS = {
  reference: {
    label: "Reference",
    description: "Hollow neon sphere: crimson top left, blue bottom right, fading into navy.",
    config: {}
  },
  orb: {
    label: "Orb",
    description: "Solid rotating planet: a lit sky-blue rim, a deep indigo shadow and a thin atmosphere.",
    config: {
      grid: { count: 34 },
      modes: {
        flow: { weight: 0 },
        sphere: {
          weight: 1,
          radius: 0.68,
          // The reference shifts the shell below its hole; a solid orb stays centered.
          shift: [0, 0],
          hole: 0,
          rimPower: 0.8,
          outerFalloff: 0.16,
          lightAngle: 215,
          lightStrength: 0.95,
          rotationSpeed: 0.3,
          tilt: 20,
          surface: 0.7,
          surfaceScale: 2.6,
          wobble: 0.02,
          breathe: 0.01,
          fadeAmount: 0
        }
      },
      animation: { floor: 0.1, flicker: { amount: 0.2 }, sparsity: { amount: 0.6 } },
      color: {
        palette: ["#120a45", "#2a1f9e", "#1f4fe0", "#0a84f2", "#10c4e8", "#8ff4ff"],
        mapping: "intensity",
        scale: 1.3,
        warp: 0.1,
        jitter: 0.08,
        intensityShift: 0,
        hot: { amount: 0.2, threshold: 0.9 },
        accent: { color: "#18d6c8", amount: 0.4 }
      },
      background: {
        color: "#01061f",
        spotA: { color: "#0c1f6e", position: [-1.1, -0.7], radius: 1.2, strength: 0.4 },
        spotB: { color: "#081a44", position: [1.1, 1], strength: 0.35 }
      },
      glow: { bloom: { strength: 0.55 }, haze: { strength: 0.2 } }
    }
  },
  pulse: {
    label: "Pulse",
    description: "Crisp rings spread from the center and gently breathe: crimson, pink, violet.",
    config: {
      grid: { count: 33 },
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 0 },
        pulse: { weight: 1, speed: 0.4, frequency: 2.2, width: 0.09, breathe: 0.5, falloff: 0.4 }
      },
      animation: {
        brightness: 1.15,
        floor: 0.07,
        flicker: { amount: 0.2 },
        sparsity: { amount: 0.25 }
      },
      color: {
        palette: ["#3a0a6e", "#7b1fa2", "#c2189b", "#f72585", "#ff6ec7", "#ff9ad8"],
        mapping: "radial",
        scale: 0.8,
        offset: 0.15,
        warp: 0.12,
        jitter: 0.08,
        intensityShift: 0.25,
        hot: { amount: 0.25, threshold: 0.88 }
      },
      background: {
        color: "#0a0019",
        spotA: { color: "#4a0d52", position: [-1.1, -0.8], strength: 0.45 },
        spotB: { color: "#22106a", position: [1, 1], strength: 0.4 }
      },
      glow: { bloom: { strength: 0.7 } }
    }
  },
  life: {
    label: "Life",
    description: "Conway's cellular automaton: cells flash quickly and fade out smoothly, in teal and mint.",
    config: {
      grid: { count: 40, gap: 0.22, roundness: 0.2 },
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 0 },
        life: { weight: 1, stepRate: 6, birthRate: 3e-3, fadeSteps: 6, seedDensity: 0.28 }
      },
      animation: {
        floor: 0.07,
        flicker: { amount: 0.08 },
        sparsity: { amount: 0 },
        sparkle: { amount: 0.12 }
      },
      color: {
        palette: ["#03302a", "#0d7a6a", "#14b8a6", "#2ee6c5", "#6ff2dc", "#b8fff0"],
        mapping: "noise",
        warp: 0.2,
        warpScale: 0.8,
        jitter: 0.08,
        intensityShift: 0.15,
        hot: { amount: 0.2, threshold: 0.9 }
      },
      background: {
        color: "#010d0c",
        vignette: 0.45,
        spotA: { color: "#053b33", position: [-1.2, -0.4], strength: 0.4 },
        spotB: { color: "#063447", position: [0.9, 1], strength: 0.35 }
      },
      lift: { amount: 6e-3 }
    }
  },
  vortex: {
    label: "Vortex",
    description: "Three-armed galaxy: a golden core, fiery arms and violet outskirts.",
    config: {
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 0.08 },
        vortex: { weight: 1, arms: 3, twist: 3.2, speed: 0.3, falloff: 0.75, sharpness: 0.55 }
      },
      animation: { floor: 0.08, sparsity: { amount: 0.45 } },
      color: {
        palette: ["#ffe8a3", "#ffb347", "#f5652a", "#d11d5b", "#8a1a9b", "#3d0f7a"],
        mapping: "radial",
        scale: 1.1,
        warp: 0.12,
        jitter: 0.08,
        intensityShift: -0.2,
        hot: { amount: 0.2, threshold: 0.9 }
      },
      background: {
        color: "#0b0014",
        spotA: { color: "#3f0d4a", position: [-1.2, 0.4], strength: 0.45 },
        spotB: { color: "#3a1405", position: [1.2, -0.8], strength: 0.3 }
      },
      glow: { bloom: { strength: 0.6 } }
    }
  },
  waves: {
    label: "Waves",
    description: "Interference plasma: bending crests from indigo through violet to sky blue.",
    config: {
      grid: { count: 34 },
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 0 },
        wave: {
          weight: 1,
          angle: 25,
          frequency: 1.3,
          speed: 0.3,
          sharpness: 0.45,
          interference: 0.85
        }
      },
      animation: { floor: 0.08, flicker: { amount: 0.15 }, sparsity: { amount: 0.35 } },
      color: {
        palette: ["#0b0630", "#2a0f7a", "#5b2bd6", "#3f6df0", "#22c3ee", "#a7f3ff"],
        mapping: "intensity",
        scale: 1.1,
        warp: 0.15,
        jitter: 0.06,
        intensityShift: 0,
        hot: { amount: 0.25, threshold: 0.9 }
      },
      background: {
        color: "#04021a",
        spotA: { color: "#1e0b5a", position: [-1.2, -0.6], strength: 0.45 },
        spotB: { color: "#062a4a", position: [0.8, 1.1], strength: 0.4 }
      }
    }
  },
  ripples: {
    label: "Ripples",
    description: "Dark water under the moon: silvery blue rings spread from random drops.",
    config: {
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 0.12, scale: 1.1, speed: 0.12, threshold: 0.62 },
        ripple: { weight: 1, rate: 1.8, speed: 0.42, width: 0.07, life: 3.2 }
      },
      animation: {
        floor: 0.06,
        flicker: { amount: 0.15 },
        sparkle: { amount: 0.2 },
        sparsity: { amount: 0.35 }
      },
      color: {
        palette: ["#0a1830", "#1c3a66", "#3d6aa8", "#7fa6d9", "#c6dcff", "#f2f7ff"],
        mapping: "intensity",
        scale: 1.2,
        warp: 0.05,
        jitter: 0.05,
        intensityShift: 0,
        saturation: 0.85,
        hot: { amount: 0.3, threshold: 0.85 }
      },
      background: {
        color: "#030814",
        vignette: 0.5,
        spotA: { color: "#12254a", position: [-1.1, -0.5], strength: 0.35 },
        spotB: { color: "#0b1733", position: [1, 1], strength: 0.3 }
      },
      glow: {
        halo: { strength: 0.55 },
        bloom: { strength: 0.55 },
        haze: { strength: 0.1 },
        saturation: 0.9
      }
    }
  },
  rain: {
    label: "Rain",
    description: 'Green "digital rain" on a near-black background, with a fine grid.',
    config: {
      grid: { count: 56, gap: 0.2, roundness: 0.15 },
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 0.08 },
        rain: { weight: 1, speed: 0.6, density: 0.32, tail: 0.6, angle: 0 }
      },
      animation: { floor: 0.1, sparsity: { amount: 0.2 }, flicker: { amount: 0.1 } },
      color: {
        palette: ["#001a00", "#003b00", "#008f11", "#00ff41", "#b6ffb0"],
        interpolation: "linear",
        mapping: "intensity",
        warp: 0,
        jitter: 0.1,
        intensityShift: 0,
        hot: { amount: 0.5, threshold: 0.85 }
      },
      background: {
        color: "#000600",
        vignette: 0.5,
        spotA: { color: "#002a08", position: [-1, -0.8], strength: 0.3 },
        spotB: { color: "#001a10", position: [1, 1], strength: 0.25 }
      },
      glow: { halo: { strength: 0.45 }, bloom: { strength: 0.3 }, haze: { strength: 0.15 } },
      lift: { amount: 6e-3, style: "float" }
    }
  },
  minimal: {
    label: "Minimal",
    description: "Monochrome white islands drift slowly over a charcoal background, with a restrained glow.",
    config: {
      grid: { count: 36, gap: 0.3, roundness: 0.25 },
      modes: {
        sphere: { weight: 0 },
        flow: { weight: 1, scale: 1.5, speed: 0.12, threshold: 0.64, softness: 0.4 }
      },
      animation: {
        floor: 0.08,
        gamma: 1.5,
        flicker: { amount: 0.25 },
        sparsity: { amount: 0.4 },
        sparkle: { amount: 0.2 }
      },
      color: {
        palette: ["#5c5c5c", "#d9d9d9", "#ffffff"],
        mapping: "intensity",
        scale: 1,
        warp: 0,
        jitter: 0,
        intensityShift: 0,
        saturation: 0,
        hot: { amount: 0 },
        accent: { amount: 0 }
      },
      background: {
        color: "#050505",
        vignette: 0.25,
        spotA: { strength: 0 },
        spotB: { strength: 0 }
      },
      glow: {
        halo: { strength: 0.25 },
        bloom: { strength: 0.12 },
        haze: { strength: 0.06 },
        saturation: 0
      },
      lift: { amount: 4e-3, whiten: 0, halo: 0.4 }
    }
  }
};

// artifacts/ribbon/vendor/lumicells/src/schema/normalize.ts
var migrations = [];
var META_KEYS = /* @__PURE__ */ new Set(["$schema", "version", "extends"]);
function isPresetId(v) {
  return typeof v === "string" && PRESET_IDS.includes(v);
}
var describe = (v) => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number" && !Number.isFinite(v)) return String(v);
  return typeof v;
};
function toNumber(v, path, issues) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) {
      issues.push({
        path,
        code: "bad-type",
        message: `expected number, coerced string "${v}"`,
        value: v
      });
      return n;
    }
  }
  issues.push({ path, code: "bad-type", message: `expected number, got ${describe(v)}`, value: v });
  return void 0;
}
function clampNum(n, f, path, issues) {
  if (f.kind === "angle" && f.fullCircle) {
    const span = f.max - f.min;
    return n >= f.min && n <= f.max ? n : ((n - f.min) % span + span) % span + f.min;
  }
  if (n < f.min || n > f.max) {
    const c = Math.min(f.max, Math.max(f.min, n));
    issues.push({
      path,
      code: "clamped",
      message: `${n} is outside [${f.min}, ${f.max}], clamped to ${c}`,
      value: n
    });
    return c;
  }
  return n;
}
function sanitizeColor(v, path, issues) {
  if (isHexColor(v)) return normalizeHex(v);
  issues.push({ path, code: "bad-color", message: `invalid color ${JSON.stringify(v)}`, value: v });
  return void 0;
}
function sanitizePalette(v, f, path, issues) {
  let arr;
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string" && isHexColor(v)) {
    issues.push({
      path,
      code: "bad-type",
      message: "expected array of colors, got one color",
      value: v
    });
    arr = [v];
  } else {
    issues.push({
      path,
      code: "bad-type",
      message: `expected array of colors, got ${describe(v)}`,
      value: v
    });
    return { ok: false };
  }
  const out = [];
  arr.forEach((c, i) => {
    const hex = sanitizeColor(c, `${path}.${i}`, issues);
    if (hex !== void 0) out.push(hex);
  });
  if (out.length > f.maxStops) {
    issues.push({
      path,
      code: "out-of-range",
      message: `${out.length} stops exceed the maximum of ${f.maxStops}, extra stops dropped`,
      value: out.length
    });
    out.length = f.maxStops;
  }
  if (out.length < f.minStops) {
    issues.push({
      path,
      code: "out-of-range",
      message: `palette needs at least ${f.minStops} valid color(s)`,
      value: v
    });
    return { ok: false };
  }
  return { ok: true, value: out };
}
function sanitizeLeaf(f, v, path, issues) {
  switch (f.kind) {
    case "number":
    case "angle":
    case "int": {
      const n = toNumber(v, path, issues);
      if (n === void 0) return { ok: false };
      const c = clampNum(n, f, path, issues);
      return { ok: true, value: f.kind === "int" ? Math.round(c) : c };
    }
    case "boolean": {
      if (typeof v === "boolean") return { ok: true, value: v };
      const coerced = v === "true" || v === 1 || v === "1" || v === "" ? true : v === "false" || v === 0 || v === "0" ? false : void 0;
      if (coerced !== void 0) {
        issues.push({
          path,
          code: "bad-type",
          message: `expected boolean, coerced ${JSON.stringify(v)}`,
          value: v
        });
        return { ok: true, value: coerced };
      }
      issues.push({
        path,
        code: "bad-type",
        message: `expected boolean, got ${describe(v)}`,
        value: v
      });
      return { ok: false };
    }
    case "color": {
      const hex = sanitizeColor(v, path, issues);
      return hex === void 0 ? { ok: false } : { ok: true, value: hex };
    }
    case "vec2": {
      if (!Array.isArray(v) || v.length !== 2) {
        issues.push({
          path,
          code: "bad-type",
          message: `expected [x, y], got ${describe(v)}`,
          value: v
        });
        return { ok: false };
      }
      const out = [];
      for (let i = 0; i < 2; i++) {
        const n = toNumber(v[i], `${path}.${i}`, issues);
        if (n === void 0) return { ok: false };
        out.push(clampNum(n, f, `${path}.${i}`, issues));
      }
      return { ok: true, value: out };
    }
    case "enum": {
      if (typeof v === "string" && f.values.includes(v)) return { ok: true, value: v };
      issues.push({
        path,
        code: "bad-type",
        message: `expected one of ${f.values.join(" | ")}, got ${JSON.stringify(v)}`,
        value: v
      });
      return { ok: false };
    }
    case "palette":
      return sanitizePalette(v, f, path, issues);
  }
}
function sanitizeGroup(g, raw, base, prefix, issues) {
  const out = {};
  for (const key of Object.keys(g.fields)) {
    const node = g.fields[key];
    if (!node) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const has = Object.hasOwn(raw, key) && raw[key] !== void 0;
    const baseVal = base?.[key];
    if (isGroup(node)) {
      const rv = has ? raw[key] : void 0;
      if (has && !isPlainObject(rv)) {
        issues.push({
          path,
          code: "bad-type",
          message: `expected object, got ${describe(rv)}`,
          value: rv
        });
      }
      const sub = sanitizeGroup(
        node,
        isPlainObject(rv) ? rv : {},
        base ? baseVal : void 0,
        path,
        issues
      );
      if (base || Object.keys(sub).length > 0) out[key] = sub;
      continue;
    }
    if (!has) {
      if (base) out[key] = cloneData(baseVal);
      continue;
    }
    const r = sanitizeLeaf(node, raw[key], path, issues);
    if (r.ok) out[key] = r.value;
    else if (base) out[key] = cloneData(baseVal);
  }
  for (const key of Object.keys(raw)) {
    if (Object.hasOwn(g.fields, key)) continue;
    if (!prefix && META_KEYS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    issues.push({
      path,
      code: "unknown-key",
      message: `unknown key '${path}' dropped`,
      value: raw[key]
    });
  }
  return out;
}
function migrate(raw, issues) {
  if (!Object.hasOwn(raw, "version") || raw.version === void 0) return raw;
  let version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    issues.push({
      path: "version",
      code: "bad-type",
      message: "version must be an integer",
      value: version
    });
    return raw;
  }
  let cur = raw;
  for (let guard = 0; guard < 32 && version !== CONFIG_VERSION; guard++) {
    const m = migrations.find((x) => x.from === version);
    if (!m) break;
    try {
      cur = m.up(cur);
    } catch {
      break;
    }
    issues.push({
      path: "version",
      code: "migrated",
      message: `migrated from v${m.from} to v${m.to}`,
      value: m.from
    });
    version = m.to;
  }
  if (version !== CONFIG_VERSION) {
    issues.push({
      path: "version",
      code: "out-of-range",
      message: `unsupported version ${version}, read as v${CONFIG_VERSION}`,
      value: version
    });
  }
  return cur;
}
function checkExtends(raw, issues) {
  const ext = raw.extends;
  if (ext === void 0) return void 0;
  if (isPresetId(ext)) return ext;
  issues.push({
    path: "extends",
    code: "bad-type",
    message: `unknown preset ${JSON.stringify(ext)}; expected one of ${PRESET_IDS.join(", ")}`,
    value: ext
  });
  return void 0;
}
function checkRoot(raw, issues) {
  if (raw === void 0 || raw === null) return {};
  if (isPlainObject(raw)) return raw;
  issues.push({
    path: "",
    code: "bad-type",
    message: `expected config object, got ${describe(raw)}`,
    value: raw
  });
  return {};
}
var presetCache = /* @__PURE__ */ new Map();
function getPresetConfig(id) {
  let cfg = presetCache.get(id);
  if (!cfg) {
    const preset = PRESETS[id];
    const merged = deepMerge(getDefaults(), preset?.config ?? {});
    const body = sanitizeGroup(schema, merged, getDefaults(), "", []);
    cfg = { ...body, version: CONFIG_VERSION };
    presetCache.set(id, cfg);
  }
  return cloneData(cfg);
}
function normalizeConfig(raw) {
  const issues = [];
  let obj = checkRoot(raw, issues);
  obj = migrate(obj, issues);
  const ext = checkExtends(obj, issues);
  const base = ext ? getPresetConfig(ext) : getDefaults();
  const body = sanitizeGroup(schema, obj, base, "", issues);
  return { config: { version: CONFIG_VERSION, ...body }, issues };
}
function normalizePatch(raw) {
  const issues = [];
  let obj = checkRoot(raw, issues);
  obj = migrate(obj, issues);
  const ext = checkExtends(obj, issues);
  const body = sanitizeGroup(schema, obj, void 0, "", issues);
  const patch = ext ? { extends: ext, ...body } : body;
  return { patch, issues };
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/frame-block.ts
var MAX_INFLUENCES = 64;
var MAX_PULSES = 16;
var MAX_LIFTS = 128;
var INF_VEC4S = 3;
var PULSE_VEC4S = 3;
var V_PHASE_A = 0;
var V_PHASE_B = 1;
var V_CLOCK = 2;
var V_GRID = 3;
var V_ORIGIN = 4;
var V_HOST = 5;
var V_SPACE = 6;
var V_COUNTS = 7;
var V_MISC = 8;
var V_EPOCH_A = 9;
var V_EPOCH_B = 10;
var HEADER_VEC4S = 11;
var EPOCH_WRAP = 1 << 20;
var FLICKER_RATE_STEPS = 256;
var OFF_PHASE_A = V_PHASE_A * 4;
var OFF_PHASE_B = V_PHASE_B * 4;
var OFF_CLOCK = V_CLOCK * 4;
var OFF_GRID = V_GRID * 4;
var OFF_ORIGIN = V_ORIGIN * 4;
var OFF_HOST = V_HOST * 4;
var OFF_SPACE = V_SPACE * 4;
var OFF_COUNTS = V_COUNTS * 4;
var OFF_MISC = V_MISC * 4;
var OFF_EPOCH_A = V_EPOCH_A * 4;
var OFF_EPOCH_B = V_EPOCH_B * 4;
var OFF_INF = HEADER_VEC4S * 4;
var OFF_PULSE = OFF_INF + MAX_INFLUENCES * INF_VEC4S * 4;
var OFF_SOCKET = OFF_PULSE + MAX_PULSES * PULSE_VEC4S * 4;
var FRAME_FLOATS = OFF_SOCKET + MAX_LIFTS * 4;
var FRAME_BYTES = FRAME_FLOATS * 4;
var UPLOAD_MERGE_GAP = 64;
function frameUploadRanges(frame, out) {
  const count = (i, max) => {
    const v = Math.floor((frame[OFF_COUNTS + i] ?? 0) + 0.5);
    return v > 0 ? Math.min(v, max) : 0;
  };
  const nInf = count(0, MAX_INFLUENCES);
  const nPulse = count(1, MAX_PULSES);
  const nSock = count(2, MAX_LIFTS);
  let n = 0;
  const add = (start, end) => {
    if (end <= start) return;
    if (n > 0 && start - out[n * 2 - 1] <= UPLOAD_MERGE_GAP) {
      out[n * 2 - 1] = end;
      return;
    }
    out[n * 2] = start;
    out[n * 2 + 1] = end;
    n++;
  };
  add(0, OFF_INF + nInf * INF_VEC4S * 4);
  add(OFF_PULSE, OFF_PULSE + nPulse * PULSE_VEC4S * 4);
  add(OFF_SOCKET, OFF_SOCKET + nSock * 4);
  return n;
}
function writeEpochPhase(frame, offset, phase) {
  const whole = Math.floor(phase);
  frame[offset] = whole;
  frame[offset + 1] = phase - whole;
}
var INFLUENCE_TYPE = { light: 0, shadow: 1, lift: 2, seed: 3, repel: 4 };
var FRAME_BLOCK_GLSL = (
  /* glsl */
  `
#define MAX_INFLUENCES ${MAX_INFLUENCES}
#define MAX_PULSES ${MAX_PULSES}
#define MAX_LIFTS ${MAX_LIFTS}
#define EPOCH_MASK ${EPOCH_WRAP - 1}u
#define FLICKER_RATE_STEPS ${FLICKER_RATE_STEPS}u
layout(std140) uniform FrameBlock {
  vec4 f_phaseA;
  vec4 f_phaseB;
  vec4 f_clock;
  vec4 f_grid;
  vec4 f_origin;
  vec4 f_host;
  vec4 f_space;
  vec4 f_counts;
  vec4 f_misc;
  vec4 f_epochA;
  vec4 f_epochB;
  vec4 f_inf[MAX_INFLUENCES * ${INF_VEC4S}];
  vec4 f_pulse[MAX_PULSES * ${PULSE_VEC4S}];
  vec4 f_socket[MAX_LIFTS];
};

// Hash epochs: the CPU accumulates each effect's phase in epochs (wrapped at EPOCH_WRAP) and
// uploads it as (whole epochs, fraction). Epoch indices are taken modulo the wrap, so crossing it
// continues the same epoch sequence; offset (a per-cell or per-slot shift, >= 0) is added to the
// fraction only, which keeps full fp32 precision. Returns the fraction, e = epoch index.
float epochAt(vec2 ph, float offset, out uint e) {
  float s = ph.y + offset;
  float fl = floor(s);
  e = (uint(ph.x) + uint(fl)) & EPOCH_MASK;
  return s - fl;
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/controller/math.ts
var TAU = Math.PI * 2;
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function sat(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function smoothstep(e0, e1, x) {
  const t = sat((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function mix(a, b, t) {
  return a + (b - a) * t;
}
function wrap(v, period) {
  const r = v % period;
  return r < 0 ? r + period : r;
}
function shortestArcDeg(from, to) {
  return wrap(to - from + 180, 360) - 180;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function linearToOklabInto(r, g, b, out, o = 0) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[o] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[o + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
function oklabToLinearInto(L, a, b, out, o = 0) {
  const l0 = L + 0.3963377774 * a + 0.2158037573 * b;
  const m0 = L - 0.1055613458 * a - 0.0638541728 * b;
  const s0 = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l0 * l0 * l0;
  const m = m0 * m0 * m0;
  const s = s0 * s0 * s0;
  out[o] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[o + 1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[o + 2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
function hexToLinearInto(hex, out, o = 0) {
  const [r, g, b] = hexToRgb(hex);
  out[o] = srgbToLinear(r);
  out[o + 1] = srgbToLinear(g);
  out[o + 2] = srgbToLinear(b);
}
function hexToOklabInto(hex, out, o = 0) {
  const [r, g, b] = hexToRgb(hex);
  linearToOklabInto(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), out, o);
}

// artifacts/ribbon/vendor/lumicells/src/core/controller/clock.ts
var NOISE_PERIOD = 1024;
var CLOCK_PERIOD = 4096;
var DRIFT_PERIOD = 2;
var Clock = class {
  flow = 0;
  sphereRotation = 0;
  sphereBreathe = 0;
  pulse = 0;
  wave = 0;
  vortex = 0;
  rain = 0;
  drift = 0;
  /** Scaled clock seconds (mod CLOCK_PERIOD): time axis of the noise lattices only. */
  seconds = 0;
  /**
   * Epoch phases (mod EPOCH_WRAP). Accumulated rather than derived from `seconds`: a wrap of
   * `seconds` would move them by a fractional number of epochs (every cell re-rolls at once), and
   * a rate or period change would jump them by `seconds * change`.
   */
  sparsity = 0;
  flicker = 0;
  sparkle = 0;
  ripple = 0;
  /** Unwrapped scaled seconds (CPU-only envelopes). */
  elapsed = 0;
  lifeAcc = 0;
  /** Life steps due this frame (0..2). */
  lifeSteps = 0;
  advance(dt, r) {
    const s = dt * r.speed;
    this.seconds = wrap(this.seconds + s, CLOCK_PERIOD);
    this.elapsed += s;
    this.flow = wrap(this.flow + s * r.flow, NOISE_PERIOD);
    this.sphereRotation = wrap(this.sphereRotation + s * r.sphereRotation, TAU);
    this.sphereBreathe = wrap(this.sphereBreathe + s * r.sphereBreathe * TAU, TAU);
    this.pulse = wrap(this.pulse + s * r.pulse, NOISE_PERIOD);
    this.wave = wrap(this.wave + s * r.wave, NOISE_PERIOD);
    this.vortex = wrap(this.vortex + s * r.vortex, TAU);
    this.rain = wrap(this.rain + s * r.rain, NOISE_PERIOD);
    this.drift = wrap(this.drift + s * r.drift, DRIFT_PERIOD);
    this.sparsity = wrap(this.sparsity + s * r.sparsity, EPOCH_WRAP);
    this.flicker = wrap(this.flicker + s * r.flicker, EPOCH_WRAP);
    this.sparkle = wrap(this.sparkle + s * r.sparkle, EPOCH_WRAP);
    this.ripple = wrap(this.ripple + s * r.ripple, EPOCH_WRAP);
    this.lifeSteps = 0;
    if (r.lifeRate > 0) {
      this.lifeAcc += s * r.lifeRate;
      while (this.lifeAcc >= 1 && this.lifeSteps < 2) {
        this.lifeAcc -= 1;
        this.lifeSteps++;
      }
      if (this.lifeAcc >= 1) this.lifeAcc %= 1;
    }
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/geometry.ts
var MAX_PAD = 16;
var MAX_GRID_CELLS = 2048;
function createGeometry() {
  return {
    canvasW: 1,
    canvasH: 1,
    canvasCssW: 1,
    canvasCssH: 1,
    effDpr: 1,
    sx: 1,
    sy: 1,
    hostX: 0,
    hostY: 0,
    hostW: 1,
    hostH: 1,
    pitchPx: 8,
    cols: 1,
    rows: 1,
    pad: 2,
    originX: 0,
    originY: 0,
    centerX: 0.5,
    centerY: 0.5,
    halfMin: 0.5
  };
}
function effectiveDpr(dpr, maxDpr, maxPixelsM, canvasCssW, canvasCssH, scale) {
  const area = Math.max(1, canvasCssW * canvasCssH);
  const budget = Math.sqrt(Math.max(0.01, maxPixelsM) * 1e6 / area);
  return Math.max(0.05, Math.min(dpr > 0 ? dpr : 1, maxDpr, budget) * (scale > 0 ? scale : 1));
}
function computeGeometry(inp, out) {
  const ov = Math.max(0, inp.overflowCss);
  const cssW = Math.max(1, inp.hostCssW + 2 * ov);
  const cssH = Math.max(1, inp.hostCssH + 2 * ov);
  const dpr = inp.dpr > 0 ? inp.dpr : 1;
  let eff = effectiveDpr(dpr, inp.maxDpr, inp.maxPixels, cssW, cssH, inp.scale);
  const maxDim = inp.maxDim !== void 0 && inp.maxDim > 0 ? inp.maxDim : 0;
  if (maxDim > 0 && (cssW * eff > maxDim || cssH * eff > maxDim)) {
    eff = Math.min(eff, maxDim / cssW, maxDim / cssH);
  }
  let cw;
  let ch;
  if (Math.abs(eff - dpr) < 1e-6 && inp.deviceW > 0 && inp.deviceH > 0 && // Sanity check: some emulated/zoomed setups report the box in CSS px.
  Math.abs(inp.deviceW - cssW * dpr) <= 2 && Math.abs(inp.deviceH - cssH * dpr) <= 2) {
    cw = inp.deviceW;
    ch = inp.deviceH;
  } else {
    cw = Math.max(1, Math.round(cssW * eff));
    ch = Math.max(1, Math.round(cssH * eff));
    if (maxDim > 0) {
      cw = Math.min(cw, maxDim);
      ch = Math.min(ch, maxDim);
    }
  }
  const sx = cw / cssW;
  const sy = ch / cssH;
  const mx = Math.round(ov * sx);
  const my = Math.round(ov * sy);
  const hw = Math.max(1, cw - 2 * mx);
  const hh = Math.max(1, ch - 2 * my);
  let pitch = Math.max(3, inp.fractionalPitch ? inp.cssPitch * sx : Math.round(inp.cssPitch * sx));
  const gridLimit = inp.maxGridCells ?? MAX_GRID_CELLS;
  pitch = Math.max(pitch, Math.ceil(Math.max(hw, hh) / (gridLimit - 2 * MAX_PAD - 2)));
  let cols = Math.ceil(hw / pitch) + 1;
  if (cols % 2 === 0) cols++;
  let rows = Math.ceil(hh / pitch) + 1;
  if (rows % 2 === 0) rows++;
  const pad = Math.min(MAX_PAD, 2 + Math.ceil(Math.max(mx, my) / pitch));
  const centerX = mx + hw / 2;
  const centerY = my + hh / 2;
  const originX = inp.alignWholeCellsX ? mx - pad * pitch : Math.round(centerX - (cols / 2 + pad) * pitch);
  const originY = inp.alignWholeCellsY ? my - pad * pitch : Math.round(centerY - (rows / 2 + pad) * pitch);
  const changed = out.canvasW !== cw || out.canvasH !== ch || out.pitchPx !== pitch || out.cols !== cols || out.rows !== rows || out.pad !== pad || out.originX !== originX || out.originY !== originY || out.hostW !== hw || out.hostH !== hh || out.effDpr !== eff;
  out.canvasW = cw;
  out.canvasH = ch;
  out.canvasCssW = cssW;
  out.canvasCssH = cssH;
  out.effDpr = eff;
  out.sx = sx;
  out.sy = sy;
  out.hostX = mx;
  out.hostY = my;
  out.hostW = hw;
  out.hostH = hh;
  out.pitchPx = pitch;
  out.cols = cols;
  out.rows = rows;
  out.pad = pad;
  out.originX = originX;
  out.originY = originY;
  out.centerX = centerX;
  out.centerY = centerY;
  out.halfMin = Math.min(hw, hh) / 2;
  return changed;
}

// artifacts/ribbon/vendor/lumicells/src/core/controller/influences.ts
var SPACE_HOST = 0;
var SPACE_NORM = 1;
var SPACE_CELLS = 2;
var SPACE_CLIENT = 3;
var SPACE_CODE = {
  host: SPACE_HOST,
  norm: SPACE_NORM,
  cells: SPACE_CELLS,
  client: SPACE_CLIENT
};
var Influence = class {
  constructor(id) {
    this.id = id;
  }
  id;
  space = SPACE_HOST;
  x = 0;
  y = 0;
  /** NaN = unset. */
  w = Number.NaN;
  h = Number.NaN;
  radius = Number.NaN;
  corner = Number.NaN;
  type = 0;
  strength = Number.NaN;
  falloff = Number.NaN;
  r = 1;
  g = 1;
  b = 1;
  colorMix = 0;
  priority = 0;
  fadeIn = 150;
  fadeOut = 250;
  ttl = Number.POSITIVE_INFINITY;
  age = 0;
  /** 0..1 fade weight on the GPU. */
  presence = 0;
  /** Holds a GPU slot. */
  slot = false;
  /** Selected for a slot this frame. */
  wanted = false;
  /** Temporarily off (fades out, keeps the entry). */
  hidden = false;
  disposing = false;
  /** Gone from the registry: handles become no-ops. */
  removed = false;
  score = 0;
};
function smooth01(p) {
  const t = p <= 0 ? 0 : p >= 1 ? 1 : p;
  return t * t * (3 - 2 * t);
}
function before(a, b) {
  if (a.priority !== b.priority) return a.priority > b.priority;
  if (a.score !== b.score) return a.score > b.score;
  return a.id < b.id;
}
var InfluenceRegistry = class {
  list = [];
  nextId = 1;
  gpu = 0;
  overflowWarned = false;
  /** Called once per registry when more influences are alive than GPU slots. */
  onOverflow = null;
  /** Live (not disposing) entries. */
  get size() {
    let n = 0;
    for (let i = 0; i < this.list.length; i++) if (!this.list[i].disposing) n++;
    return n;
  }
  /** Entries currently holding a GPU slot. */
  get activeCount() {
    return this.gpu;
  }
  /** True when some live entry is in `client` space (the host rect must be measured). */
  get needsClientOrigin() {
    for (let i = 0; i < this.list.length; i++) {
      if (this.list[i].space === SPACE_CLIENT) return true;
    }
    return false;
  }
  add(init) {
    const e = new Influence(this.nextId++);
    this.apply(e, init);
    this.list.push(e);
    return e;
  }
  update(e, patch) {
    if (e.removed) return;
    this.apply(e, patch);
  }
  /** Moves an entry without touching anything else (hot path for trackers; no allocation). */
  setShape(e, space, x, y, w, h) {
    e.space = space;
    e.x = x;
    e.y = y;
    e.w = w;
    e.h = h;
  }
  setHidden(e, hidden) {
    e.hidden = hidden;
  }
  /**
   * Fades out, then frees. Idempotent. An entry without a GPU slot has nothing to fade and is
   * freed right away, so disposals never pile up while the instance is not rendering (stopped,
   * paused, offscreen); only slot holders (at most MAX_INFLUENCES) wait for the next frames.
   */
  dispose(e) {
    if (e.removed) return;
    e.disposing = true;
    if (e.slot) return;
    e.removed = true;
    const i = this.list.indexOf(e);
    if (i >= 0) this.list.splice(i, 1);
  }
  /** Drops everything immediately (instance destroyed). */
  clear() {
    for (const e of this.list) {
      e.removed = true;
      e.disposing = true;
      e.slot = false;
    }
    this.list.length = 0;
    this.gpu = 0;
  }
  /**
   * Advances fades / ttl, picks the GPU set and writes f_inf records into `frame`.
   * Returns the number of records written.
   */
  step(dt, ctx, frame) {
    const dtMs = dt * 1e3;
    const list = this.list;
    let w = 0;
    let eligible = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.disposing) {
        e.age += dtMs;
        if (e.age >= e.ttl) e.disposing = true;
      }
      if (e.disposing && !e.slot) {
        e.removed = true;
        continue;
      }
      if (!e.disposing && !e.hidden) eligible++;
      list[w++] = e;
    }
    list.length = w;
    if (eligible > MAX_INFLUENCES) {
      if (!this.overflowWarned) {
        this.overflowWarned = true;
        this.onOverflow?.(eligible);
      }
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        e.score = this.strengthOf(e, ctx) * this.areaOf(e, ctx.geo);
      }
      for (let i = 1; i < list.length; i++) {
        const e = list[i];
        let j = i - 1;
        while (j >= 0 && before(e, list[j])) {
          list[j + 1] = list[j];
          j--;
        }
        list[j + 1] = e;
      }
      let n2 = 0;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        e.wanted = !e.disposing && !e.hidden && n2 < MAX_INFLUENCES;
        if (e.wanted) n2++;
      }
    } else {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        e.wanted = !e.disposing && !e.hidden;
      }
    }
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.slot) continue;
      if (e.wanted) {
        e.presence = e.fadeIn > 0 ? Math.min(1, e.presence + dtMs / e.fadeIn) : 1;
      } else {
        e.presence = e.fadeOut > 0 ? e.presence - dtMs / e.fadeOut : 0;
        if (e.presence <= 0) {
          e.presence = 0;
          e.slot = false;
          this.gpu--;
        }
      }
    }
    for (let i = 0; i < list.length && this.gpu < MAX_INFLUENCES; i++) {
      const e = list[i];
      if (e.slot || !e.wanted) continue;
      e.slot = true;
      this.gpu++;
      e.presence = e.fadeIn > 0 ? Math.min(1, dtMs / e.fadeIn) : 1;
    }
    let n = 0;
    for (let i = 0; i < list.length && n < MAX_INFLUENCES; i++) {
      const e = list[i];
      if (!e.slot || e.presence <= 0) continue;
      this.write(e, ctx, frame, OFF_INF + n * 12);
      n++;
    }
    return n;
  }
  // -------------------------------------------------------------------------------------------
  apply(e, p) {
    if (p.space !== void 0) e.space = SPACE_CODE[p.space] ?? SPACE_HOST;
    if (p.x !== void 0) e.x = p.x;
    if (p.y !== void 0) e.y = p.y;
    if (p.w !== void 0) e.w = p.w;
    if (p.h !== void 0) e.h = p.h;
    if (p.radius !== void 0) e.radius = p.radius;
    if (p.cornerRadius !== void 0) e.corner = p.cornerRadius ?? Number.NaN;
    if (p.type !== void 0) e.type = INFLUENCE_TYPE[p.type] ?? 0;
    if (p.strength !== void 0) e.strength = p.strength;
    if (p.falloff !== void 0) e.falloff = p.falloff;
    if (p.color !== void 0) {
      const rgb = [1, 1, 1];
      hexToLinearInto(p.color, rgb);
      e.r = rgb[0];
      e.g = rgb[1];
      e.b = rgb[2];
      if (p.colorMix === void 0 && e.colorMix === 0) e.colorMix = 0.5;
    }
    if (p.colorMix !== void 0) e.colorMix = Math.max(0, Math.min(1, p.colorMix));
    if (p.priority !== void 0) e.priority = p.priority;
    if (p.fadeInMs !== void 0) e.fadeIn = Math.max(0, p.fadeInMs);
    if (p.fadeOutMs !== void 0) e.fadeOut = Math.max(0, p.fadeOutMs);
    if (p.ttlMs !== void 0) {
      e.ttl = p.ttlMs > 0 ? p.ttlMs : Number.POSITIVE_INFINITY;
      e.age = 0;
    }
  }
  strengthOf(e, ctx) {
    return Number.isNaN(e.strength) ? ctx.defaultStrength : e.strength;
  }
  /** Units per device px for sizes in this entry's space. */
  unit(e, g, axis) {
    switch (e.space) {
      case SPACE_NORM:
        return axis === 0 ? g.hostW : axis === 1 ? g.hostH : Math.min(g.hostW, g.hostH);
      case SPACE_CELLS:
        return g.pitchPx;
      default:
        return axis === 1 ? g.sy : g.sx;
    }
  }
  areaOf(e, g) {
    if (!Number.isNaN(e.w) || !Number.isNaN(e.h)) {
      const w = (Number.isNaN(e.w) ? 0 : e.w) * this.unit(e, g, 0);
      const h = (Number.isNaN(e.h) ? 0 : e.h) * this.unit(e, g, 1);
      return Math.max(1, w * h);
    }
    const r = (Number.isNaN(e.radius) ? 0 : e.radius) * this.unit(e, g, 2);
    return Math.max(1, Math.PI * r * r);
  }
  write(e, ctx, f, o) {
    const g = ctx.geo;
    let px;
    let py;
    switch (e.space) {
      case SPACE_NORM:
        px = g.hostX + e.x * g.hostW;
        py = g.hostY + e.y * g.hostH;
        break;
      case SPACE_CELLS:
        px = g.originX + (g.pad + e.x + 0.5) * g.pitchPx;
        py = g.originY + (g.pad + e.y + 0.5) * g.pitchPx;
        break;
      case SPACE_CLIENT:
        px = g.hostX + (e.x - ctx.clientX) * g.sx;
        py = g.hostY + (e.y - ctx.clientY) * g.sy;
        break;
      default:
        px = g.hostX + e.x * g.sx;
        py = g.hostY + e.y * g.sy;
    }
    let hw = 0;
    let hh = 0;
    let corner;
    if (!Number.isNaN(e.w) || !Number.isNaN(e.h)) {
      hw = Math.max(0, (Number.isNaN(e.w) ? 0 : e.w) * 0.5 * this.unit(e, g, 0));
      hh = Math.max(0, (Number.isNaN(e.h) ? 0 : e.h) * 0.5 * this.unit(e, g, 1));
      const c = Number.isNaN(e.corner) ? 0 : e.corner * this.unit(e, g, 2);
      corner = Math.max(0, Math.min(c, hw, hh));
    } else {
      corner = Math.max(0, (Number.isNaN(e.radius) ? 0 : e.radius) * this.unit(e, g, 2));
    }
    const falloff = Number.isNaN(e.falloff) ? ctx.defaultFalloff : e.falloff;
    f[o] = px;
    f[o + 1] = py;
    f[o + 2] = hw;
    f[o + 3] = hh;
    f[o + 4] = corner;
    f[o + 5] = Math.max(0, falloff) * g.pitchPx;
    f[o + 6] = this.strengthOf(e, ctx) * smooth01(e.presence);
    f[o + 7] = e.type;
    f[o + 8] = e.r;
    f[o + 9] = e.g;
    f[o + 10] = e.b;
    f[o + 11] = e.colorMix;
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/layout.ts
var MAX_PARAM_VEC4 = 64;
function paramsDefine(path) {
  return `P_${path.replace(/\./g, "_")}`;
}
function enumDefine(path, value) {
  return `E_${path.replace(/\./g, "_")}_${value}`;
}
function slotSize(f) {
  if (f.kind === "vec2") return 2;
  if (f.kind === "color") return 3;
  return 1;
}
function glslFloat(n) {
  return Number.isInteger(n) ? `${n}.0` : String(n);
}
var SWIZZLE = "xyzw";
var linearCache = /* @__PURE__ */ new Map();
function hexToLinear(hex) {
  let v = linearCache.get(hex);
  if (!v) {
    const [r, g, b] = hexToRgb(hex);
    v = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
    if (linearCache.size > 256) linearCache.clear();
    linearCache.set(hex, v);
  }
  return v;
}
function getByPath(cfg, path) {
  let cur = cfg;
  for (const key of path.split(".")) {
    if (typeof cur !== "object" || cur === null) return void 0;
    cur = cur[key];
  }
  return cur;
}
function createParamLayout(root = schema) {
  const gpuFields = [];
  walkSchema((node, path) => {
    if (!isGroup(node) && node.gpu) gpuFields.push({ path, field: node });
  }, root);
  const used = [];
  const place = (size) => {
    const candidates = size === 1 ? [0, 1, 2, 3] : size === 2 ? [0, 2] : [0];
    const mask = size === 1 ? 1 : size === 2 ? 3 : 7;
    for (let i = 0; ; i++) {
      const u = used[i] ?? 0;
      for (const c of candidates) {
        const m = mask << c;
        if ((u & m) === 0) {
          used[i] = u | m;
          return [i, c];
        }
      }
    }
  };
  const slots = /* @__PURE__ */ new Map();
  const paths = [];
  for (const { path, field } of gpuFields) {
    if (field.kind === "palette") {
      throw new Error(`lumicells: palette field '${path}' cannot be packed (use the LUT)`);
    }
    const size = slotSize(field);
    const [index, comp] = place(size);
    slots.set(path, {
      index,
      comp,
      size,
      kind: field.kind,
      offset: index * 4 + comp,
      define: paramsDefine(path),
      field
    });
    paths.push(path);
  }
  const vec4Count = Math.max(1, used.length);
  if (vec4Count > MAX_PARAM_VEC4) {
    throw new Error(`lumicells: ${vec4Count} param vec4s exceed the limit of ${MAX_PARAM_VEC4}`);
  }
  const lines = [
    `#define PARAMS_VEC4_COUNT ${vec4Count}`,
    `layout(std140) uniform ParamsBlock { vec4 u_p[${vec4Count}]; };`
  ];
  for (const path of paths) {
    const s = slots.get(path);
    const swz = SWIZZLE.slice(s.comp, s.comp + s.size);
    lines.push(`#define ${s.define} u_p[${s.index}].${swz}`);
  }
  MODE_IDS.forEach((id, i) => {
    lines.push(`#define MODE_${id.toUpperCase()} ${i}`);
  });
  walkSchema((node, path) => {
    if (node.kind === "enum") {
      node.values.forEach((v, i) => {
        lines.push(`#define ${enumDefine(path, v)} ${glslFloat(i)}`);
      });
    }
  }, root);
  const glslPrelude = `${lines.join("\n")}
`;
  const write = (target, path, value) => {
    const s = slots.get(path);
    if (!s) return false;
    const o = s.offset;
    switch (s.kind) {
      case "angle":
        target[o] = value * Math.PI / 180;
        break;
      case "boolean":
        target[o] = value ? 1 : 0;
        break;
      case "enum": {
        if (typeof value === "number") target[o] = value;
        else {
          const i = s.field.values.indexOf(value);
          target[o] = i < 0 ? 0 : i;
        }
        break;
      }
      case "color": {
        const lin = typeof value === "string" ? hexToLinear(value) : value;
        target[o] = lin[0] ?? 0;
        target[o + 1] = lin[1] ?? 0;
        target[o + 2] = lin[2] ?? 0;
        break;
      }
      case "vec2": {
        const v = value;
        target[o] = v[0] ?? 0;
        target[o + 1] = v[1] ?? 0;
        break;
      }
      default:
        target[o] = value;
    }
    return true;
  };
  const writeAll = (target, config) => {
    for (const path of paths) {
      const v = getByPath(config, path);
      if (v !== void 0) write(target, path, v);
    }
  };
  return { slots, paths, vec4Count, floatCount: vec4Count * 4, glslPrelude, write, writeAll };
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/types.ts
var LIFT_STRIDE = 12;
var LIFT_CELL_X = 0;
var LIFT_CELL_Y = 1;
var LIFT_OFF_X = 2;
var LIFT_OFF_Y = 3;
var LIFT_SCALE_X = 4;
var LIFT_SCALE_Y = 5;
var LIFT_TILT_X = 6;
var LIFT_TILT_Y = 7;
var LIFT_H = 8;
var LIFT_ALPHA = 9;
var LIFT_BLUR = 10;
var LIFT_SEED = 11;
var EngineError = class extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
    this.name = "EngineError";
  }
  code;
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/lifts.ts
function createLiftParams() {
  return {
    enabled: true,
    style: 0,
    amount: 0.016,
    max: 96,
    scale: 1.5,
    height: 0.35,
    parallax: 0.06,
    tilt: 6,
    holdMin: 1.5,
    holdMax: 3.5,
    rise: 0.6,
    fall: 0.45,
    bokeh: 0.3,
    socket: 0.6,
    outerBias: 0.85,
    cluster: 0.15,
    landing: 0.25,
    floatSpeed: 0.9,
    floatDrift: 0.4,
    sceneX: 0,
    sceneY: 0,
    zoom: 1
  };
}
var LANDING = 0.09;
var SPRING_ZETA = 0.55;
var SPRING_DAMPED = Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);
function springRise(t, rise) {
  if (t <= 0) return 0;
  const w = TAU / Math.max(0.05, rise) * 0.9;
  const zw = SPRING_ZETA * w;
  const wd = w * Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);
  return 1 - Math.exp(-zw * t) * (Math.cos(wd * t) + zw / wd * Math.sin(wd * t));
}
function bob(t, rise, seed) {
  return 0.03 * Math.sin(TAU * 0.45 * t + seed * TAU) * Math.min(1, t / Math.max(0.05, rise));
}
var F = 19;
var CI = 0;
var CJ = 1;
var AGE = 2;
var HOLD = 3;
var SEED = 4;
var DEPTH = 5;
var RISE = 6;
var FALL = 7;
var H0 = 8;
var T0 = 9;
var PHASE = 10;
var STYLE = 11;
var FORCED = 12;
var TILT_A = 13;
var TILT_B = 14;
var F1 = 15;
var F2 = 16;
var P1 = 17;
var P2 = 18;
var DEG = Math.PI / 180;
var NEIGHBOURS = [-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1];
var LiftScheduler = class {
  constructor(random, pulses) {
    this.random = random;
    this.pulses = pulses;
  }
  random;
  pulses;
  instances = new Float32Array(MAX_LIFTS * LIFT_STRIDE);
  /** Records alive (including ones still waiting for a cluster delay). */
  count = 0;
  /** Instances written by the last step(). */
  written = 0;
  /**
   * Expected-event mass left before the next random spawn. Spawns form a Poisson process
   * with exponential inter-arrival masses, so random numbers are drawn only when something
   * spawns (not every frame) and a varying rate needs no special handling.
   */
  budget = -1;
  rec = new Float64Array(MAX_LIFTS * F);
  landingPulse = {
    space: SPACE_CELLS,
    x: 0,
    y: 0,
    strength: 0,
    speed: 6,
    width: 1,
    r: 1,
    g: 1,
    b: 1,
    colorMix: 0,
    duration: 0.5,
    minor: true
  };
  clear() {
    this.count = 0;
    this.written = 0;
  }
  /** Expected lifetime of one random lift, seconds. */
  static meanLifetime(p) {
    const lo = Math.min(p.holdMin, p.holdMax);
    const hi = Math.max(p.holdMin, p.holdMax);
    return p.rise + (lo + hi) / 2 + p.fall + (p.style === 0 ? LANDING : 0);
  }
  /**
   * Lifts `count` cells around the cell (ci, cj) (relative to the center cell), the first one
   * exactly there, the others within `radius` cells. Returns how many were added.
   */
  force(ci, cj, count, radius, p, geo) {
    const hx = (geo.cols - 1) / 2;
    const hy = (geo.rows - 1) / 2;
    let added = 0;
    const n = Math.max(1, Math.floor(count));
    for (let k = 0, tries = 0; k < n && tries < n * 6 && this.count < MAX_LIFTS; tries++) {
      let x = Math.round(ci);
      let y = Math.round(cj);
      if (k > 0 || tries > 0) {
        const a = this.random() * TAU;
        const r = Math.sqrt(this.random()) * Math.max(1, radius);
        x = Math.round(ci + Math.cos(a) * r);
        y = Math.round(cj + Math.sin(a) * r);
      }
      if (Math.abs(x) > hx || Math.abs(y) > hy || this.has(x, y)) continue;
      this.spawn(x, y, k === 0 ? 0 : -this.random() * 0.12, p, true);
      added++;
      k++;
    }
    return added;
  }
  /**
   * Spawns, ages and evaluates lifts; writes instances and sockets.
   * Returns the number of sockets (= instances) written.
   */
  step(dt, p, geo, frame) {
    this.spawnRandom(dt, p, geo);
    const rec = this.rec;
    const out = this.instances;
    const hx = (geo.cols - 1) / 2;
    const hy = (geo.rows - 1) / 2;
    const pitch = geo.pitchPx;
    const tiltRad = p.tilt * DEG;
    let w = 0;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const o = i * F;
      const ci = rec[o + CI];
      const cj = rec[o + CJ];
      if (Math.abs(ci) > hx || Math.abs(cj) > hy) continue;
      const age = rec[o + AGE] + dt;
      rec[o + AGE] = age;
      let keep = true;
      let h = 0;
      let alpha = 0;
      let sx = 1;
      let sy = 1;
      let dx = 0;
      let dy = 0;
      let sock = 0;
      if (age >= 0) {
        const rise = rec[o + RISE];
        const seed = rec[o + SEED];
        const sw = TAU / rise * 0.9;
        const zw = SPRING_ZETA * sw;
        const wd = sw * SPRING_DAMPED;
        const up = 1 - Math.exp(-zw * age) * (Math.cos(wd * age) + zw / wd * Math.sin(wd * age)) + 0.03 * Math.sin(TAU * 0.45 * age + seed * TAU) * Math.min(1, age / rise);
        if (rec[o + STYLE] === 1) {
          const life = rise + rec[o + HOLD] + rec[o + FALL];
          if (age >= life) keep = false;
          else {
            h = up;
            const u = age / life;
            alpha = Math.min(1, h * 4) * (1 - smoothstep(0.7, 1, u));
            const s = mix(1, 0.8, u);
            sx = s;
            sy = s;
            const ramp = Math.min(1, age);
            const drift = p.floatDrift * pitch * ramp;
            dx = drift * (Math.sin(TAU * rec[o + F1] * age + rec[o + P1]) + 0.5 * Math.sin(TAU * rec[o + F2] * age + rec[o + P2]));
            dy = -p.floatSpeed * pitch * age + 0.3 * drift * Math.sin(TAU * rec[o + F2] * age + rec[o + P1]);
            sock = p.socket * Math.min(1, Math.max(0, h)) * (1 - smoothstep(0.15, 0.5, u));
          }
        } else {
          const hold = rec[o + HOLD];
          const fall = Math.max(0.05, rec[o + FALL]);
          let phase = rec[o + PHASE];
          if (phase === 0 && age >= rise + hold) {
            phase = 1;
            rec[o + PHASE] = 1;
            rec[o + T0] = rise + hold;
            rec[o + H0] = springRise(rise + hold, rise) + bob(rise + hold, rise, seed);
          }
          if (phase === 1) {
            const k = (age - rec[o + T0]) / fall;
            if (k >= 1) {
              phase = 2;
              rec[o + PHASE] = 2;
              rec[o + T0] = age;
              this.land(ci + hx, cj + hy, p);
            } else {
              h = rec[o + H0] * (1 - k * k);
            }
          }
          if (phase === 0) {
            h = up;
          } else if (phase === 2) {
            const u = (age - rec[o + T0]) / LANDING;
            if (u >= 1) keep = false;
            else {
              const q = Math.sin(Math.PI * u);
              sx = 1 + 0.06 * q;
              sy = 1 - 0.06 * q;
              h = 0;
              alpha = 1 - u;
            }
          }
          if (phase !== 2) alpha = Math.min(1, Math.max(0, h) * 4);
          sock = p.socket * Math.min(1, Math.max(0, h));
        }
      }
      if (!keep) continue;
      if (w !== i) rec.copyWithin(w * F, o, o + F);
      w++;
      if (age < 0 || n >= MAX_LIFTS) continue;
      const hp = Math.max(0, h);
      const tx = ci + hx + geo.pad;
      const ty = cj + hy + geo.pad;
      const cx = geo.originX + (tx + 0.5) * pitch;
      const cy = geo.originY + (ty + 0.5) * pitch;
      const lo = n * LIFT_STRIDE;
      const sc = 1 + (p.scale - 1) * hp;
      out[lo + LIFT_CELL_X] = tx;
      out[lo + LIFT_CELL_Y] = ty;
      out[lo + LIFT_OFF_X] = (cx - geo.centerX) * p.parallax * hp + dx;
      out[lo + LIFT_OFF_Y] = (cy - geo.centerY) * p.parallax * hp - p.height * pitch * hp + dy;
      out[lo + LIFT_SCALE_X] = sc * sx;
      out[lo + LIFT_SCALE_Y] = sc * sy;
      out[lo + LIFT_TILT_X] = rec[o + TILT_A] * tiltRad * hp;
      out[lo + LIFT_TILT_Y] = rec[o + TILT_B] * tiltRad * hp;
      out[lo + LIFT_H] = h;
      out[lo + LIFT_ALPHA] = alpha;
      const depth = rec[o + DEPTH];
      out[lo + LIFT_BLUR] = depth < p.bokeh ? (0.12 + 0.18 * depth / Math.max(p.bokeh, 1e-3)) * pitch * hp : 0;
      out[lo + LIFT_SEED] = rec[o + SEED];
      const so = OFF_SOCKET + n * 4;
      frame[so] = tx;
      frame[so + 1] = ty;
      frame[so + 2] = sock;
      frame[so + 3] = 0;
      n++;
    }
    this.count = w;
    this.written = n;
    return n;
  }
  // -------------------------------------------------------------------------------------------
  has(ci, cj) {
    const rec = this.rec;
    for (let i = 0; i < this.count; i++) {
      if (rec[i * F + CI] === ci && rec[i * F + CJ] === cj) return true;
    }
    return false;
  }
  spawnRandom(dt, p, geo) {
    if (!p.enabled || !(p.amount > 0) || !(p.max >= 1) || dt <= 0) return;
    const pitch = geo.pitchPx;
    const mx = Math.floor(geo.hostW / 2 / pitch);
    const my = Math.floor(geo.hostH / 2 / pitch);
    const cells = (2 * mx + 1) * (2 * my + 1);
    const lo = p.holdMin < p.holdMax ? p.holdMin : p.holdMax;
    const hi = p.holdMin < p.holdMax ? p.holdMax : p.holdMin;
    const life = p.rise + (lo + hi) / 2 + p.fall + (p.style === 0 ? LANDING : 0);
    const rate = p.amount * cells / life / (1 + 2 * Math.max(0, p.cluster));
    if (this.budget < 0) this.budget = -Math.log(1 - this.random());
    this.budget -= rate * dt;
    if (this.budget > 0) return;
    const cap = Math.min(MAX_LIFTS, Math.floor(p.max));
    const inv = 1 / Math.max(1, geo.halfMin);
    const zoom = Math.max(0.05, p.zoom);
    for (let guard = 0; this.budget <= 0 && guard < 64; guard++) {
      this.budget += -Math.log(1 - this.random());
      if (this.count >= cap) continue;
      for (let tries = 0; tries < 24; tries++) {
        const ci = Math.floor(this.random() * (2 * mx + 1)) - mx;
        const cj = Math.floor(this.random() * (2 * my + 1)) - my;
        const px = (ci * pitch * inv - p.sceneX) / zoom;
        const py = (cj * pitch * inv - p.sceneY) / zoom;
        const r = Math.sqrt(px * px + py * py);
        const weight2 = mix(
          1,
          smoothstep(0.6, 0.85, r) * (1 - 0.6 * smoothstep(1.15, 1.45, r)),
          p.outerBias
        );
        if (this.random() >= weight2 || this.has(ci, cj)) continue;
        this.spawn(ci, cj, 0, p, false);
        if (this.random() < p.cluster) this.spawnCluster(ci, cj, mx, my, cap, p);
        break;
      }
    }
    if (this.budget < 0) this.budget = 0;
  }
  spawnCluster(ci, cj, mx, my, cap, p) {
    const extra = 1 + Math.floor(this.random() * 3);
    for (let e = 0; e < extra && this.count < cap; e++) {
      const dir = Math.floor(this.random() * 8) * 2;
      const x = ci + NEIGHBOURS[dir];
      const y = cj + NEIGHBOURS[dir + 1];
      if (Math.abs(x) > mx || Math.abs(y) > my || this.has(x, y)) continue;
      this.spawn(x, y, -(0.04 + this.random() * 0.14), p, false);
    }
  }
  spawn(ci, cj, age, p, forced) {
    if (this.count >= MAX_LIFTS) return;
    const rnd = this.random;
    const o = this.count * F;
    const rec = this.rec;
    const lo = Math.min(p.holdMin, p.holdMax);
    const hi = Math.max(p.holdMin, p.holdMax);
    rec[o + CI] = ci;
    rec[o + CJ] = cj;
    rec[o + AGE] = age;
    rec[o + HOLD] = lo + rnd() * (hi - lo);
    rec[o + SEED] = rnd();
    rec[o + DEPTH] = rnd();
    rec[o + RISE] = Math.max(0.05, p.rise);
    rec[o + FALL] = Math.max(0.05, p.fall);
    rec[o + H0] = 1;
    rec[o + T0] = 0;
    rec[o + PHASE] = 0;
    rec[o + STYLE] = p.style;
    rec[o + FORCED] = forced ? 1 : 0;
    rec[o + TILT_A] = rnd() * 2 - 1;
    rec[o + TILT_B] = rnd() * 2 - 1;
    rec[o + F1] = 0.2 + 0.3 * rnd();
    rec[o + F2] = 0.5 + 0.6 * rnd();
    rec[o + P1] = rnd() * TAU;
    rec[o + P2] = rnd() * TAU;
    this.count++;
  }
  /** Landing ripple at the cell (visible-cell coordinates). */
  land(cellX, cellY, p) {
    if (!this.pulses || !(p.landing > 0)) return;
    const lp = this.landingPulse;
    lp.x = cellX;
    lp.y = cellY;
    lp.strength = p.landing;
    this.pulses.add(lp);
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/lut.ts
var LUT_SIZE = 256;
var HOT_L = 0.93;
var HOT_C = 0.35;
function srgbByte(lin) {
  const c = lin <= 0 ? 0 : lin >= 1 ? 1 : lin;
  const s = c <= 31308e-7 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}
var SRGB_STEPS = 8192;
var srgbTable = null;
function srgbLut() {
  if (!srgbTable) {
    srgbTable = new Uint8Array(SRGB_STEPS + 1);
    for (let i = 0; i <= SRGB_STEPS; i++) srgbTable[i] = srgbByte(i / SRGB_STEPS);
  }
  return srgbTable;
}
function bakePaletteOklab(palette2, interpolation, out) {
  const n = palette2.length;
  if (n === 0) {
    out.fill(0);
    return;
  }
  const stops = new Float64Array(n * 3);
  if (interpolation === "linear") {
    for (let i = 0; i < n; i++) {
      const [r, g, b] = hexToRgb(palette2[i]);
      stops[i * 3] = srgbToLinear(r);
      stops[i * 3 + 1] = srgbToLinear(g);
      stops[i * 3 + 2] = srgbToLinear(b);
    }
  } else {
    for (let i = 0; i < n; i++) hexToOklabInto(palette2[i], stops, i * 3);
  }
  const tmp = new Float64Array(3);
  for (let x = 0; x < LUT_SIZE; x++) {
    const t = x / (LUT_SIZE - 1);
    const o = x * 3;
    if (n === 1) {
      out[o] = stops[0];
      out[o + 1] = stops[1];
      out[o + 2] = stops[2];
      continue;
    }
    if (interpolation === "steps") {
      const i2 = Math.min(n - 1, Math.floor(t * n)) * 3;
      out[o] = stops[i2];
      out[o + 1] = stops[i2 + 1];
      out[o + 2] = stops[i2 + 2];
      continue;
    }
    const f = t * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    const k = f - i;
    const a = i * 3;
    const b = a + 3;
    for (let c = 0; c < 3; c++) {
      tmp[c] = stops[a + c] + (stops[b + c] - stops[a + c]) * k;
    }
    if (interpolation === "linear") {
      linearToOklabInto(tmp[0], tmp[1], tmp[2], out, o);
    } else {
      out[o] = tmp[0];
      out[o + 1] = tmp[1];
      out[o + 2] = tmp[2];
    }
  }
}
var PaletteLut = class {
  /** Texture bytes: row 0 palette, row 1 hot tint. */
  bytes = new Uint8Array(LUT_SIZE * 2 * 4);
  /** Set when `bytes` changed; cleared by the consumer after upload. */
  dirty = true;
  cur = new Float32Array(LUT_SIZE * 3);
  tgt = new Float32Array(LUT_SIZE * 3);
  srgb = srgbLut();
  animating = false;
  dur = 0;
  constructor(palette2, interpolation) {
    bakePaletteOklab(palette2, interpolation, this.tgt);
    this.cur.set(this.tgt);
    this.encode();
  }
  get transitioning() {
    return this.animating;
  }
  /** Re-bakes the target; the ramp moves there over `durationMs` (<= 0: instantly). */
  setTarget(palette2, interpolation, durationMs) {
    bakePaletteOklab(palette2, interpolation, this.tgt);
    if (durationMs > 0) {
      this.dur = durationMs;
      this.animating = true;
    } else {
      this.cur.set(this.tgt);
      this.animating = false;
      this.encode();
    }
  }
  /** Advances the transition; returns true when the bytes changed. */
  update(dt) {
    if (!this.animating) return false;
    const k = this.dur > 0 ? 1 - Math.exp(-dt * 5e3 / this.dur) : 1;
    let done = true;
    const cur = this.cur;
    const tgt = this.tgt;
    for (let i = 0; i < cur.length; i++) {
      const t = tgt[i];
      let v = cur[i];
      v += (t - v) * k;
      if (Math.abs(t - v) < 1e-4) v = t;
      else done = false;
      cur[i] = v;
    }
    if (done) this.animating = false;
    this.encode();
    return true;
  }
  /** OKLab value of entry `x` (tests, debugging). */
  sampleOklab(x, out) {
    const o = Math.max(0, Math.min(LUT_SIZE - 1, x | 0)) * 3;
    out[0] = this.cur[o];
    out[1] = this.cur[o + 1];
    out[2] = this.cur[o + 2];
  }
  /** OKLab -> linear -> sRGB bytes for both rows, fully inline (runs every transition frame). */
  encode() {
    const b = this.bytes;
    const cur = this.cur;
    const tab = this.srgb;
    const N = SRGB_STEPS;
    for (let x = 0; x < LUT_SIZE; x++) {
      const A0 = cur[x * 3 + 1];
      const B0 = cur[x * 3 + 2];
      for (let row = 0; row < 2; row++) {
        const L = row === 0 ? cur[x * 3] : HOT_L;
        const A = row === 0 ? A0 : A0 * HOT_C;
        const B = row === 0 ? B0 : B0 * HOT_C;
        const l0 = L + 0.3963377774 * A + 0.2158037573 * B;
        const m0 = L - 0.1055613458 * A - 0.0638541728 * B;
        const s0 = L - 0.0894841775 * A - 1.291485548 * B;
        const l = l0 * l0 * l0;
        const m = m0 * m0 * m0;
        const s = s0 * s0 * s0;
        const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
        const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
        const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
        const o = row * LUT_SIZE * 4 + x * 4;
        b[o] = tab[r <= 0 ? 0 : r >= 1 ? N : r * N + 0.5 | 0];
        b[o + 1] = tab[g <= 0 ? 0 : g >= 1 ? N : g * N + 0.5 | 0];
        b[o + 2] = tab[bl <= 0 ? 0 : bl >= 1 ? N : bl * N + 0.5 | 0];
        b[o + 3] = 255;
      }
    }
    this.dirty = true;
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/perf.ts
var QUALITY_LEVELS = [
  { quality: "high", scale: 1 },
  { quality: "medium", scale: 1 },
  { quality: "medium", scale: 0.85 },
  { quality: "low", scale: 0.85 },
  { quality: "low", scale: 0.72 },
  { quality: "low", scale: 0.6 },
  { quality: "low", scale: 0.5 }
];
var VSYNC_CANDIDATES = [4.17, 6.06, 6.94, 8.33, 11.11, 16.67, 33.33];
var PERF_WINDOW = 120;
var STEP_DOWN_AFTER = 2e3;
var STEP_UP_AFTER = 5e3;
var MIN_INTERVAL = 2e3;
var VERIFY_AFTER = 2e3;
var BLACKLIST_MS = 3e4;
var MAX_BLACKLIST_MS = 3e5;
var LOCK_MS = 18e4;
var RISE_SHARE = 0.8;
var VERIFY_NONE = 0;
var VERIFY_DOWN = 1;
var VERIFY_UP = 2;
function nearestCandidate(d) {
  let best = -1;
  let bestErr = 0.15;
  for (let i = 0; i < VSYNC_CANDIDATES.length; i++) {
    const err = Math.abs(d / VSYNC_CANDIDATES[i] - 1);
    if (err < bestErr) {
      bestErr = err;
      best = i;
    }
  }
  return best;
}
var PerfController = class {
  mode = "auto";
  level = 0;
  locked = false;
  vsyncMs = 16.67;
  /**
   * Dominant rAF cadence in the window (ms): the interval frames actually arrive at. Unlike the
   * sticky vsyncMs it follows a display that got slower, so frame pacing (maxFps) uses it.
   */
  cadenceMs = 16.67;
  missRatio = 0;
  frameMs = 16.67;
  fps = 60;
  cpuMs = 0;
  gpuMs = null;
  deltas = new Float64Array(PERF_WINDOW);
  cand = new Int8Array(PERF_WINDOW);
  counts = new Int32Array(VSYNC_CANDIDATES.length);
  blacklist = new Float64Array(QUALITY_LEVELS.length);
  /** Failed step-ups per level (exponential blacklist backoff), reset when the level holds. */
  fails = new Uint8Array(QUALITY_LEVELS.length);
  lockedUntil = 0;
  head = 0;
  n = 0;
  sum = 0;
  slowSince = -1;
  goodSince = -1;
  lastChange = Number.NEGATIVE_INFINITY;
  verify = VERIFY_NONE;
  verifyAt = 0;
  verifyFrom = 0;
  missBefore = 0;
  /** Consecutive steps down without fewer misses, and the level before the first of them. */
  noGain = 0;
  streakFrom = 0;
  /** Fastest refresh interval seen (sticky), ms. */
  bestVsync = Number.POSITIVE_INFINITY;
  change = { quality: "high", scale: 1, reason: "slow" };
  get quality() {
    if (this.mode !== "auto") return this.mode;
    return QUALITY_LEVELS[this.level].quality;
  }
  get scale() {
    if (this.mode !== "auto") return 1;
    return QUALITY_LEVELS[this.level].scale;
  }
  /** Samples in the current window. */
  get samples() {
    return this.n;
  }
  /** Switches between adaptive and a fixed tier; returns true when quality or scale changed. */
  setMode(mode) {
    if (mode === this.mode) return false;
    const q = this.quality;
    const s = this.scale;
    this.mode = mode;
    if (mode === "auto") {
      this.level = 0;
      this.locked = false;
      this.verify = VERIFY_NONE;
      this.noGain = 0;
      this.blacklist.fill(0);
      this.fails.fill(0);
      this.resetWindow();
    }
    return q !== this.quality || s !== this.scale;
  }
  /**
   * Forgets the sticky refresh estimate and every conclusion drawn from it: the lock, the
   * no-gain streak and the step-up backoff (the window moved to another display, the DPR
   * changed, or the page resumes from a hidden tab where OS power modes may have changed).
   */
  resetVsync() {
    this.bestVsync = Number.POSITIVE_INFINITY;
    this.locked = false;
    this.noGain = 0;
    this.blacklist.fill(0);
    this.fails.fill(0);
    this.resetWindow();
  }
  /** Forgets the timing window (after a pause or a resize, stale deltas are meaningless). */
  resetWindow() {
    this.n = 0;
    this.head = 0;
    this.sum = 0;
    this.counts.fill(0);
    this.slowSince = -1;
    this.goodSince = -1;
  }
  /**
   * Feeds one frame: rAF delta, our CPU time for the frame, the GPU time if measured, and the
   * frame timestamp (ms). Returns a (reused) change record when the level changed.
   */
  sample(deltaMs, cpuMs, gpuMs, now) {
    const d = deltaMs > 0.5 ? deltaMs < 1e3 ? deltaMs : 1e3 : 0.5;
    if (this.n === PERF_WINDOW) {
      this.sum -= this.deltas[this.head];
      const c2 = this.cand[this.head];
      if (c2 >= 0) this.counts[c2] = this.counts[c2] - 1;
    } else {
      this.n++;
    }
    const c = nearestCandidate(d);
    this.deltas[this.head] = d;
    this.cand[this.head] = c;
    if (c >= 0) this.counts[c] = this.counts[c] + 1;
    this.sum += d;
    this.head = (this.head + 1) % PERF_WINDOW;
    const n = this.n;
    this.cpuMs += (Math.max(0, cpuMs) - this.cpuMs) * 0.1;
    if (gpuMs !== null && Number.isFinite(gpuMs)) {
      this.gpuMs = this.gpuMs === null ? gpuMs : this.gpuMs + (gpuMs - this.gpuMs) * 0.1;
    }
    if (n >= 20) {
      let vs2 = -1;
      let maxI = -1;
      let maxC = 0;
      for (let i = 0; i < VSYNC_CANDIDATES.length; i++) {
        const cnt = this.counts[i];
        if (vs2 < 0 && cnt >= 0.2 * n) vs2 = i;
        if (cnt > maxC) {
          maxC = cnt;
          maxI = i;
        }
      }
      if (vs2 < 0) vs2 = maxI;
      if (maxI >= 0) this.cadenceMs = VSYNC_CANDIDATES[maxI];
      if (vs2 >= 0) {
        const est = VSYNC_CANDIDATES[vs2];
        if (n >= 30 && est < this.bestVsync) this.bestVsync = est;
        this.vsyncMs = Math.min(est, this.bestVsync);
      }
      if (n === PERF_WINDOW && maxI >= 0 && maxC >= RISE_SHARE * n) this.maybeRise(maxI);
    }
    const limit = 1.5 * this.vsyncMs;
    let miss = 0;
    for (let i = 0; i < n; i++) if (this.deltas[i] > limit) miss++;
    this.missRatio = n > 0 ? miss / n : 0;
    this.frameMs = n > 0 ? this.sum / n : d;
    this.fps = 1e3 / this.frameMs;
    if (this.locked && now >= this.lockedUntil) this.locked = false;
    if (this.mode !== "auto" || this.locked) return null;
    const vsync = this.vsyncMs;
    const gpu = this.gpuMs;
    if (this.verify === VERIFY_UP) {
      if (now - this.verifyAt >= VERIFY_AFTER) {
        this.verify = VERIFY_NONE;
        this.fails[this.level] = 0;
      } else if (n >= 30) {
        const slowish = gpu !== null ? gpu > 0.75 * vsync : this.missRatio > 0.15;
        if (slowish) {
          const f = this.fails[this.level];
          this.blacklist[this.level] = now + Math.min(BLACKLIST_MS * 2 ** f, MAX_BLACKLIST_MS);
          this.fails[this.level] = Math.min(16, f + 1);
          return this.apply(this.verifyFrom, now, "slow");
        }
      }
    }
    if (n < 60) return null;
    if (this.verify === VERIFY_DOWN && now - this.verifyAt >= VERIFY_AFTER) {
      this.verify = VERIFY_NONE;
      const improved = this.missRatio < 0.1 || this.missRatio < this.missBefore - 0.05;
      if (gpu !== null || improved) {
        this.noGain = 0;
      } else {
        if (this.noGain++ === 0) this.streakFrom = this.verifyFrom;
        if (this.noGain >= 2) {
          this.locked = true;
          this.lockedUntil = now + LOCK_MS;
          this.noGain = 0;
          this.bestVsync = Number.POSITIVE_INFINITY;
          return this.apply(this.streakFrom, now, "locked");
        }
      }
    }
    const slow = gpu !== null ? gpu > 0.75 * vsync : this.missRatio > 0.25 && this.cpuMs < 0.3 * vsync;
    const good = this.missRatio < 0.02 && (gpu === null || gpu < 0.5 * vsync);
    this.slowSince = slow ? this.slowSince < 0 ? now : this.slowSince : -1;
    this.goodSince = good ? this.goodSince < 0 ? now : this.goodSince : -1;
    if (now - this.lastChange < MIN_INTERVAL) return null;
    if (this.slowSince >= 0 && now - this.slowSince >= STEP_DOWN_AFTER && this.level < QUALITY_LEVELS.length - 1) {
      const from = this.level;
      const missBefore = this.missRatio;
      const ch = this.apply(from + 1, now, "slow");
      this.verify = VERIFY_DOWN;
      this.verifyFrom = from;
      this.missBefore = missBefore;
      return ch;
    }
    if (this.goodSince >= 0 && now - this.goodSince >= STEP_UP_AFTER && this.level > 0 && this.blacklist[this.level - 1] <= now) {
      const from = this.level;
      const ch = this.apply(from - 1, now, "recovered");
      this.verify = VERIFY_UP;
      this.verifyFrom = from;
      return ch;
    }
    return null;
  }
  /**
   * Most of a full window arrives at candidate `i`. If that is slower than the sticky estimate
   * and our own cost is small, the display or the OS (low-power mode, energy saver, a 60 Hz
   * monitor) sets the pace, not our GPU: adopt the slower rate.
   */
  maybeRise(i) {
    const slower = VSYNC_CANDIDATES[i];
    if (!(slower > this.bestVsync * 1.1)) return;
    const gpu = this.gpuMs;
    const small = gpu !== null ? gpu < 0.5 * slower && this.cpuMs < 0.5 * slower : this.locked && this.cpuMs < 0.3 * slower;
    if (!small) return;
    this.bestVsync = slower;
    this.vsyncMs = slower;
    this.missRatio = 0;
    this.noGain = 0;
    this.resetWindow();
  }
  apply(level, now, reason) {
    this.level = level;
    this.lastChange = now;
    this.verifyAt = now;
    this.verify = VERIFY_NONE;
    this.resetWindow();
    const ch = this.change;
    ch.quality = this.quality;
    ch.scale = this.scale;
    ch.reason = reason;
    return ch;
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/pulses.ts
var ATTACK = 0.06;
var PulseList = class {
  space = new Uint8Array(MAX_PULSES);
  minor = new Uint8Array(MAX_PULSES);
  /** x, y, strength, speed, width, r, g, b, colorMix, age, duration */
  data = new Float64Array(MAX_PULSES * 11);
  count = 0;
  add(p) {
    let i = this.count;
    if (i >= MAX_PULSES) {
      i = this.oldest(true);
      if (i < 0) i = this.oldest(false);
    } else {
      this.count++;
    }
    const d = this.data;
    const o = i * 11;
    this.space[i] = p.space;
    this.minor[i] = p.minor ? 1 : 0;
    d[o] = p.x;
    d[o + 1] = p.y;
    d[o + 2] = p.strength;
    d[o + 3] = p.speed;
    d[o + 4] = p.width;
    d[o + 5] = p.r;
    d[o + 6] = p.g;
    d[o + 7] = p.b;
    d[o + 8] = p.colorMix;
    d[o + 9] = 0;
    d[o + 10] = Math.max(0.05, p.duration);
  }
  clear() {
    this.count = 0;
  }
  get needsClientOrigin() {
    for (let i = 0; i < this.count; i++) if (this.space[i] === SPACE_CLIENT) return true;
    return false;
  }
  /** Current strength of pulse `i` (tests). */
  strengthAt(i) {
    const o = i * 11;
    const d = this.data;
    return d[o + 2] * envelope(d[o + 9], d[o + 10]);
  }
  /** Current radius of pulse `i` in cells (tests). */
  radiusCells(i) {
    const o = i * 11;
    return this.data[o + 3] * this.data[o + 9];
  }
  /** Ages pulses, drops expired ones and writes f_pulse. Returns the count written. */
  step(dt, geo, clientX, clientY, frame) {
    const d = this.data;
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const o = i * 11;
      const age = d[o + 9] + dt;
      if (age >= d[o + 10]) continue;
      d[o + 9] = age;
      if (w !== i) {
        d.copyWithin(w * 11, o, o + 11);
        this.space[w] = this.space[i];
        this.minor[w] = this.minor[i];
      }
      w++;
    }
    this.count = w;
    const pitch = geo.pitchPx;
    for (let i = 0; i < w; i++) {
      const o = i * 11;
      const x = d[o];
      const y = d[o + 1];
      let px;
      let py;
      switch (this.space[i]) {
        case SPACE_NORM:
          px = geo.hostX + x * geo.hostW;
          py = geo.hostY + y * geo.hostH;
          break;
        case SPACE_CELLS:
          px = geo.originX + (geo.pad + x + 0.5) * pitch;
          py = geo.originY + (geo.pad + y + 0.5) * pitch;
          break;
        case SPACE_CLIENT:
          px = geo.hostX + (x - clientX) * geo.sx;
          py = geo.hostY + (y - clientY) * geo.sy;
          break;
        default:
          px = geo.hostX + x * geo.sx;
          py = geo.hostY + y * geo.sy;
      }
      const age = d[o + 9];
      const f = OFF_PULSE + i * 12;
      frame[f] = px;
      frame[f + 1] = py;
      frame[f + 2] = d[o + 3] * age * pitch;
      frame[f + 3] = d[o + 4] * pitch;
      frame[f + 4] = d[o + 2] * envelope(age, d[o + 10]);
      frame[f + 5] = d[o + 8];
      frame[f + 6] = 0;
      frame[f + 7] = 0;
      frame[f + 8] = d[o + 5];
      frame[f + 9] = d[o + 6];
      frame[f + 10] = d[o + 7];
      frame[f + 11] = 0;
    }
    return w;
  }
  oldest(minorOnly) {
    let best = -1;
    let bestAge = -1;
    for (let i = 0; i < this.count; i++) {
      if (minorOnly && this.minor[i] !== 1) continue;
      const age = this.data[i * 11 + 9] / this.data[i * 11 + 10];
      if (age > bestAge) {
        bestAge = age;
        best = i;
      }
    }
    return best;
  }
};
function envelope(age, duration) {
  const a = age < ATTACK ? age / ATTACK : 1;
  return a * (1 - smoothstep(0, 1, age / duration));
}

// artifacts/ribbon/vendor/lumicells/src/core/controller/modulators.ts
var BLEND_CODE = { add: 0, mul: 1, override: 2, max: 3 };
var SRC_NUMBER = 0;
var SRC_FUNCTION = 1;
var SRC_OBJECT = 2;
var Modulator = class {
  blend;
  /** Exponential smoothing half-life of the source in ms (0 = none). */
  halfLifeMs;
  /** Smoothed source value. */
  value = 0;
  primed = false;
  disposed = false;
  // The source is split by kind so a numeric source lives in a double field: set(v) every
  // frame then writes in place instead of boxing a number into a mixed-type field.
  kind = SRC_NUMBER;
  num = 0;
  fn = null;
  obj = null;
  constructor(source, blend = "add", smoothingMs = 0) {
    this.blend = BLEND_CODE[blend] ?? 0;
    this.halfLifeMs = smoothingMs > 0 ? smoothingMs : 0;
    this.setSource(source);
  }
  setSource(source) {
    if (typeof source === "number") {
      this.kind = SRC_NUMBER;
      this.num = source;
    } else if (typeof source === "function") {
      this.kind = SRC_FUNCTION;
      this.fn = source;
    } else {
      this.kind = SRC_OBJECT;
      this.obj = source;
    }
  }
  /**
   * Reads the source (non-finite readings keep the previous value) and smooths into `value`.
   * Until the first finite reading the modulator is not `primed` and composes as the identity.
   */
  sample(dtSec) {
    let raw;
    if (this.kind === SRC_NUMBER) raw = this.num;
    else {
      try {
        raw = this.kind === SRC_FUNCTION ? this.fn() : this.obj.get();
      } catch {
        raw = Number.NaN;
      }
    }
    if (!Number.isFinite(raw)) return;
    if (!this.primed || this.halfLifeMs <= 0) {
      this.value = raw;
      this.primed = true;
    } else {
      const k = 1 - 2 ** (-dtSec * 1e3 / this.halfLifeMs);
      this.value += (raw - this.value) * k;
    }
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/tween.ts
var K_NUM = 0;
var K_ANGLE = 1;
var K_BOOL = 2;
var K_COLOR = 3;
var K_VEC2 = 4;
var K_ENUM = 5;
var K_XFADE = 6;
var K_OTHER = 7;
var DEG2 = Math.PI / 180;
function kindOf(f) {
  switch (f.kind) {
    case "number":
    case "int":
      return K_NUM;
    case "angle":
      return K_ANGLE;
    case "boolean":
      return K_BOOL;
    case "color":
      return K_COLOR;
    case "vec2":
      return K_VEC2;
    case "enum":
      return f.transition === "crossfade" ? K_XFADE : K_ENUM;
    default:
      return K_OTHER;
  }
}
function compsOf(kind) {
  if (kind === K_NUM || kind === K_ANGLE || kind === K_XFADE) return 1;
  if (kind === K_VEC2) return 2;
  if (kind === K_COLOR) return 3;
  return 0;
}
var ParamStore = class {
  constructor(layout, config) {
    this.layout = layout;
    this.params = new Float32Array(layout.floatCount);
    let off = 0;
    for (const path of getLeafPaths()) {
      const field = getField(path);
      if (!field) continue;
      const kind = kindOf(field);
      const n = compsOf(kind);
      const ranged = field;
      const lo = typeof ranged.min === "number" ? ranged.min : 0;
      const hi = typeof ranged.max === "number" ? ranged.max : 1;
      const tweenable = n > 0 && (field.live === "uniform" || field.live === "realloc") && ranged.tween !== "none";
      const eps = kind === K_COLOR || kind === K_XFADE ? 1e-4 : Math.max(1e-9, (hi - lo) * 1e-4);
      const e = {
        id: this.entries.length,
        path,
        field,
        kind,
        off,
        n,
        lo,
        hi,
        eps,
        tweenable,
        fullCircle: kind === K_ANGLE && field.fullCircle === true,
        slot: layout.slots.get(path),
        dur: 0,
        active: false,
        mods: null,
        eff: 0,
        index: 0,
        prev: 0
      };
      off += n;
      this.entries.push(e);
      this.byPath.set(path, e);
    }
    this.cur = new Float64Array(off);
    this.tgt = new Float64Array(off);
    this.active = new Int32Array(this.entries.length);
    this.modIds = new Int32Array(8);
    this.reset(config);
  }
  layout;
  params;
  /** Set whenever a ParamsBlock slot is written; cleared by the consumer. */
  dirty = true;
  entries = [];
  byPath = /* @__PURE__ */ new Map();
  cur;
  tgt;
  active;
  activeCount = 0;
  modIds;
  modCount = 0;
  rgb = new Float64Array(3);
  /** Entry id for a path (resolve once, then read with `num(id)` every frame). */
  id(path) {
    const e = this.byPath.get(path);
    if (!e) throw new Error(`[lumicells] unknown parameter '${path}'`);
    return e.id;
  }
  entry(path) {
    return this.byPath.get(path);
  }
  /** Snaps every value to `config` (no tweens) and rewrites the whole ParamsBlock. */
  reset(config) {
    this.activeCount = 0;
    for (const e of this.entries) {
      e.active = false;
      this.snapTo(e, getPath(config, e.path));
      if (e.kind === K_XFADE) e.prev = e.index;
      this.refresh(e);
    }
    this.dirty = true;
  }
  /**
   * Starts tweening `path` toward `value` over `durationMs` (<= 0 or non-tweenable: instant).
   */
  setTarget(path, value, durationMs) {
    const e = this.byPath.get(path);
    if (!e) return;
    if (!e.tweenable || !(durationMs > 0)) {
      if (e.kind === K_XFADE) {
        const idx = this.enumIndex(e, value);
        e.index = idx;
        e.prev = idx;
        this.cur[e.off] = 1;
        this.tgt[e.off] = 1;
      } else {
        this.snapTo(e, value);
      }
      if (e.active) this.deactivate(e);
      this.refresh(e);
      return;
    }
    const o = e.off;
    switch (e.kind) {
      case K_NUM:
        this.tgt[o] = value;
        break;
      case K_ANGLE: {
        const v = value;
        this.tgt[o] = e.fullCircle ? (this.cur[o] ?? 0) + shortestArcDeg(this.cur[o] ?? 0, v) : v;
        break;
      }
      case K_VEC2: {
        const v = value;
        this.tgt[o] = v[0] ?? 0;
        this.tgt[o + 1] = v[1] ?? 0;
        break;
      }
      case K_COLOR:
        hexToOklabInto(value, this.tgt, o);
        break;
      case K_XFADE: {
        const idx = this.enumIndex(e, value);
        if (idx === e.index) return;
        const mix2 = this.cur[o] ?? 1;
        if (idx === e.prev && mix2 < 1) {
          e.prev = e.index;
          e.index = idx;
          this.cur[o] = 1 - mix2;
        } else {
          e.prev = mix2 >= 0.5 ? e.index : e.prev;
          e.index = idx;
          this.cur[o] = 0;
        }
        this.tgt[o] = 1;
        this.refresh(e);
        break;
      }
    }
    e.dur = durationMs;
    if (!e.active) {
      e.active = true;
      this.active[this.activeCount++] = e.id;
    }
  }
  /** Advances tweens and modulators by `dt` seconds. Returns true if any slot was written. */
  update(dt) {
    const before2 = this.dirty;
    this.dirty = false;
    let w = 0;
    for (let i = 0; i < this.activeCount; i++) {
      const id = this.active[i];
      const e = this.entries[id];
      const done = this.step(e, dt);
      if (!e.mods) this.refresh(e);
      if (done) e.active = false;
      else this.active[w++] = id;
    }
    this.activeCount = w;
    for (let i = 0; i < this.modCount; i++) {
      const e = this.entries[this.modIds[i]];
      const mods = e.mods;
      if (!mods) continue;
      let v = e.kind === K_NUM || e.kind === K_ANGLE ? this.cur[e.off] : e.index;
      for (let j = 0; j < mods.length; j++) {
        const m = mods[j];
        if (m.disposed) continue;
        m.sample(dt);
        if (!m.primed) continue;
        const sv = m.value;
        if (m.blend === 1) v *= sv;
        else if (m.blend === 2) v = sv;
        else if (m.blend === 3) v = v > sv ? v : sv;
        else v += sv;
      }
      v = e.fullCircle ? e.lo + wrap(v - e.lo, e.hi - e.lo) : v < e.lo ? e.lo : v > e.hi ? e.hi : v;
      if (v !== e.eff) {
        e.eff = v;
        const sl = e.slot;
        if (sl && e.kind === K_NUM) {
          this.params[sl.offset] = v;
          this.dirty = true;
        } else {
          this.writeSlot(e);
        }
      }
    }
    const changed = this.dirty;
    this.dirty = before2 || changed;
    return changed;
  }
  /** True while any tween is running (modulators are not counted). */
  get animating() {
    return this.activeCount > 0;
  }
  /** Effective scalar: numbers/ints, angles (degrees), enum index, boolean 0/1. */
  num(id) {
    return this.entries[id].eff;
  }
  /** Tweened component `c` of a vec2 (or color OKLab) entry. */
  comp(id, c) {
    const e = this.entries[id];
    return this.cur[e.off + c] ?? 0;
  }
  /** Crossfade state of a `crossfade` enum: previous index and mix (1 = current only). */
  crossfadePrev(id) {
    return this.entries[id].prev;
  }
  crossfadeMix(id) {
    const e = this.entries[id];
    return e.kind === K_XFADE ? this.cur[e.off] ?? 1 : 1;
  }
  /** Tweening or modulated right now (its effective value may change this frame). */
  isLive(id) {
    const e = this.entries[id];
    return e.active || e.mods !== null;
  }
  getEffective(path) {
    return this.byPath.get(path)?.eff ?? Number.NaN;
  }
  isModulated(path) {
    return !!this.byPath.get(path)?.mods;
  }
  /** Adds a modulator on a numeric path. Returns null for non-numeric paths. */
  addModulator(path, source, blend, smoothingMs) {
    const e = this.byPath.get(path);
    if (!e || e.kind !== K_NUM && e.kind !== K_ANGLE) return null;
    const m = new Modulator(source, blend, smoothingMs);
    if (!e.mods) {
      e.mods = [];
      if (this.modCount >= this.modIds.length) {
        const grown = new Int32Array(this.modIds.length * 2);
        grown.set(this.modIds);
        this.modIds = grown;
      }
      this.modIds[this.modCount++] = e.id;
    }
    e.mods.push(m);
    return m;
  }
  removeModulator(path, m) {
    m.disposed = true;
    const e = this.byPath.get(path);
    if (!e?.mods) return;
    const i = e.mods.indexOf(m);
    if (i >= 0) e.mods.splice(i, 1);
    if (e.mods.length > 0) return;
    e.mods = null;
    let w = 0;
    for (let i2 = 0; i2 < this.modCount; i2++) {
      const id = this.modIds[i2];
      if (id !== e.id) this.modIds[w++] = id;
    }
    this.modCount = w;
    this.refresh(e);
  }
  // -------------------------------------------------------------------------------------------
  enumIndex(e, value) {
    if (typeof value === "number") return value;
    const values = e.field.values ?? [];
    const i = values.indexOf(value);
    return i < 0 ? 0 : i;
  }
  deactivate(e) {
    e.active = false;
    let w = 0;
    for (let i = 0; i < this.activeCount; i++) {
      const id = this.active[i];
      if (id !== e.id) this.active[w++] = id;
    }
    this.activeCount = w;
  }
  snapTo(e, value) {
    const o = e.off;
    switch (e.kind) {
      case K_NUM:
      case K_ANGLE: {
        const v = typeof value === "number" ? value : 0;
        this.cur[o] = v;
        this.tgt[o] = v;
        break;
      }
      case K_VEC2: {
        const v = value ?? [0, 0];
        this.cur[o] = v[0] ?? 0;
        this.cur[o + 1] = v[1] ?? 0;
        this.tgt[o] = this.cur[o];
        this.tgt[o + 1] = this.cur[o + 1];
        break;
      }
      case K_COLOR:
        hexToOklabInto(typeof value === "string" ? value : "#000000", this.cur, o);
        this.tgt[o] = this.cur[o];
        this.tgt[o + 1] = this.cur[o + 1];
        this.tgt[o + 2] = this.cur[o + 2];
        break;
      case K_XFADE:
        e.index = this.enumIndex(e, value);
        this.cur[o] = 1;
        this.tgt[o] = 1;
        break;
      case K_ENUM:
        e.index = this.enumIndex(e, value);
        break;
      case K_BOOL:
        e.index = value ? 1 : 0;
        break;
    }
  }
  /** One exponential step of every component; returns true when all snapped. */
  step(e, dt) {
    const k = e.dur > 0 ? 1 - Math.exp(-dt * 5e3 / e.dur) : 1;
    let done = true;
    const end = e.off + e.n;
    for (let j = e.off; j < end; j++) {
      const t = this.tgt[j];
      let v = this.cur[j];
      v += (t - v) * k;
      if (Math.abs(t - v) <= e.eps) v = t;
      else done = false;
      this.cur[j] = v;
    }
    if (done && e.fullCircle) {
      const v = e.lo + wrap(this.cur[e.off] - e.lo, e.hi - e.lo);
      this.cur[e.off] = v;
      this.tgt[e.off] = v;
    }
    return done;
  }
  /** Recomputes the effective value from the tweened one (no modulators) and writes the slot. */
  refresh(e) {
    switch (e.kind) {
      case K_NUM: {
        const v = this.cur[e.off];
        e.eff = v;
        const sl = e.slot;
        if (sl && !e.mods) {
          this.params[sl.offset] = v;
          this.dirty = true;
        }
        return;
      }
      case K_ANGLE: {
        const v = this.cur[e.off];
        e.eff = e.fullCircle ? e.lo + wrap(v - e.lo, e.hi - e.lo) : v;
        break;
      }
      case K_ENUM:
      case K_XFADE:
      case K_BOOL:
        e.eff = e.index;
        break;
      default:
        e.eff = 0;
    }
    if (e.mods) return;
    this.writeSlot(e);
  }
  writeSlot(e) {
    const s = e.slot;
    if (!s) return;
    const p = this.params;
    const o = s.offset;
    switch (e.kind) {
      case K_NUM:
      case K_ENUM:
      case K_XFADE:
      case K_BOOL:
        p[o] = e.eff;
        break;
      case K_ANGLE:
        p[o] = e.fullCircle ? wrap(e.eff * DEG2, TAU) : e.eff * DEG2;
        break;
      case K_VEC2:
        p[o] = this.cur[e.off];
        p[o + 1] = this.cur[e.off + 1];
        break;
      case K_COLOR: {
        const c = this.rgb;
        oklabToLinearInto(
          this.cur[e.off],
          this.cur[e.off + 1],
          this.cur[e.off + 2],
          c
        );
        p[o] = Math.max(0, c[0]);
        p[o + 1] = Math.max(0, c[1]);
        p[o + 2] = Math.max(0, c[2]);
        break;
      }
      default:
        return;
    }
    this.dirty = true;
  }
};
var ScalarTween = class {
  constructor(value, eps = 1e-4) {
    this.eps = eps;
    this.cur = value;
    this.tgt = value;
  }
  eps;
  cur;
  tgt;
  dur = 0;
  set(value, durationMs) {
    this.tgt = value;
    this.dur = durationMs;
    if (!(durationMs > 0)) this.cur = value;
  }
  /** Returns true while moving. */
  step(dt) {
    if (this.cur === this.tgt) return false;
    const k = this.dur > 0 ? 1 - Math.exp(-dt * 5e3 / this.dur) : 1;
    this.cur += (this.tgt - this.cur) * k;
    if (Math.abs(this.tgt - this.cur) <= this.eps) this.cur = this.tgt;
    return true;
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/controller/controller.ts
var FORCED_QUEUE = 32;
var sharedLayout = null;
function getSharedLayout() {
  if (!sharedLayout) sharedLayout = createParamLayout();
  return sharedLayout;
}
var Controller = class {
  /** Native output integration; composite tiles bound the full-resolution allocations. */
  nativeResolution = false;
  /** Production pitch in output pixels; zero preserves the author's shorter-side sizing. */
  nativeGridPitch = 0;
  /** Local comparison: keep complete rows against the viewport edges. */
  nativeGridAlignY = false;
  nativeGridAlignX = false;
  nativeGridFractionalPitch = false;
  nativeGridMaxCells = 2048;
  layout;
  store;
  lut;
  clock = new Clock();
  influences = new InfluenceRegistry();
  pulses = new PulseList();
  lifts;
  perf = new PerfController();
  geo = createGeometry();
  frame;
  /** Set when the geometry changed; the facade clears it after emitting 'resize'. */
  geometryChanged = true;
  destroyed = false;
  config;
  random;
  onWarn;
  sizingMix;
  rates = {
    speed: 1,
    flow: 0,
    sphereRotation: 0,
    sphereBreathe: 0,
    pulse: 0,
    wave: 0,
    vortex: 0,
    rain: 0,
    drift: 0,
    lifeRate: 0,
    sparsity: 0,
    flicker: 0,
    sparkle: 0,
    ripple: 0
  };
  liftParams = createLiftParams();
  geoIn = {
    hostCssW: 300,
    hostCssH: 150,
    overflowCss: 0,
    dpr: 1,
    deviceW: 0,
    deviceH: 0,
    maxDpr: 2,
    maxPixels: 4.2,
    scale: 1,
    cssPitch: 10,
    maxDim: 0
  };
  infCtx;
  forced = new Float64Array(FORCED_QUEUE * 5);
  forcedCount = 0;
  pulseInit = {
    space: 0,
    x: 0,
    y: 0,
    strength: 0,
    speed: 0,
    width: 0,
    r: 1,
    g: 1,
    b: 1,
    colorMix: 0,
    duration: 1,
    minor: false
  };
  tmp = new Float64Array(3);
  pixelCap = Number.POSITIVE_INFINITY;
  reducedMotion = false;
  software = false;
  clientX = 0;
  clientY = 0;
  hasViewport = false;
  // Resolved entry ids of the parameters read every frame.
  ids;
  constructor(opts = {}) {
    this.random = opts.random ?? mulberry32(Math.random() * 4294967296 >>> 0);
    this.onWarn = opts.onWarn;
    this.layout = opts.layout ?? getSharedLayout();
    this.config = normalizeConfig(opts.config ?? {}).config;
    this.store = new ParamStore(this.layout, this.config);
    this.lut = new PaletteLut(this.config.color.palette, this.config.color.interpolation);
    this.lifts = new LiftScheduler(this.random, this.pulses);
    this.sizingMix = new ScalarTween(this.config.grid.sizing === "pitch" ? 1 : 0);
    this.perf.setMode(this.config.render.quality);
    this.influences.onOverflow = (alive) => this.warn(
      "influence-overflow",
      `[lumicells] ${alive} influences are alive but only 64 fit on the GPU; lower-priority ones fade out.`
    );
    this.infCtx = {
      geo: this.geo,
      clientX: 0,
      clientY: 0,
      defaultStrength: 0.8,
      defaultFalloff: 2
    };
    this.ids = resolveIds(this.store);
    this.frame = {
      canvasWidth: 1,
      canvasHeight: 1,
      cols: 1,
      rows: 1,
      pad: 2,
      pitchPx: 8,
      params: this.store.params,
      paramsDirty: true,
      frame: new Float32Array(FRAME_FLOATS),
      lut: this.lut.bytes,
      lutDirty: true,
      lifeSteps: 0,
      lifeReset: true,
      lifeSeed: this.random() * 4294967296 >>> 0,
      lifeRule: 0,
      lifeBirth: 0,
      lifeSeedDensity: 0.3,
      lifts: this.lifts.instances,
      liftCount: 0,
      bloomSigma: 1.2,
      hazeSigma: 6,
      bloomStrength: 0.8,
      hazeStrength: 0.12,
      quality: "high",
      opaque: true,
      debugView: 0
    };
    this.updateGeometry();
  }
  // -------------------------------------------------------------------------------------------
  // Config
  getConfig() {
    return this.config;
  }
  /** Merges a partial config; returns the changed leaf paths (schema order). */
  setConfig(patch, opts = {}) {
    if (this.destroyed) return [];
    const { patch: clean } = normalizePatch(patch);
    return this.commit(normalizeConfig(deepMerge(this.config, clean)).config, opts);
  }
  /** Replaces the whole config (missing keys fall back to defaults / `extends`). */
  replaceConfig(input, opts = {}) {
    if (this.destroyed) return [];
    return this.commit(normalizeConfig(input).config, opts);
  }
  getEffective(path) {
    const v = this.store.getEffective(path);
    return Number.isNaN(v) ? getPath(this.config, path) : v;
  }
  modulate(path, source, opts = {}) {
    const store = this.store;
    const m = this.destroyed ? null : store.addModulator(path, source, opts.blend, opts.smoothingMs);
    let disposed = !m;
    const dispose = () => {
      if (disposed || !m) return;
      disposed = true;
      opts.signal?.removeEventListener("abort", dispose);
      if (!this.destroyed) store.removeModulator(path, m);
    };
    if (m && opts.signal) {
      if (opts.signal.aborted) dispose();
      else opts.signal.addEventListener("abort", dispose, { once: true });
    }
    return {
      set: (v) => {
        if (!disposed && m) m.setSource(v);
      },
      dispose,
      [Symbol.dispose]: dispose
    };
  }
  // -------------------------------------------------------------------------------------------
  // Influences, pulses, lifts
  /** Raw registry entry (the DOM trackers move it without allocating). */
  createInfluence(init) {
    return this.influences.add(init);
  }
  /** Public handle for an entry; `onDispose` runs once when the handle is disposed. */
  influenceHandle(e, signal, onDispose) {
    const reg = this.influences;
    let done = false;
    const dispose = () => {
      if (done) return;
      done = true;
      signal?.removeEventListener("abort", dispose);
      reg.dispose(e);
      onDispose?.();
    };
    if (signal) {
      if (signal.aborted) dispose();
      else signal.addEventListener("abort", dispose, { once: true });
    }
    return {
      id: e.id,
      get active() {
        return e.slot && !e.removed;
      },
      update: (patch) => {
        if (!done) reg.update(e, patch);
      },
      dispose,
      [Symbol.dispose]: dispose
    };
  }
  addInfluence(init, signal) {
    if (this.destroyed) return deadInfluence();
    return this.influenceHandle(this.createInfluence(init), signal);
  }
  pulse(req) {
    if (this.destroyed) return;
    const s = this.store;
    const ids = this.ids;
    const p = this.pulseInit;
    p.space = SPACE_CODE[req.space ?? "host"] ?? SPACE_HOST;
    p.x = req.x;
    p.y = req.y;
    p.strength = req.strength ?? s.num(ids.rippleStrength);
    p.speed = Math.max(0.01, req.speed ?? s.num(ids.rippleSpeed));
    p.width = Math.max(0.05, req.width ?? s.num(ids.rippleWidth));
    if (req.color) {
      hexToLinearInto(req.color, this.tmp);
      p.r = this.tmp[0];
      p.g = this.tmp[1];
      p.b = this.tmp[2];
      p.colorMix = req.colorMix ?? 0.5;
    } else {
      p.r = 1;
      p.g = 1;
      p.b = 1;
      p.colorMix = req.colorMix ?? 0;
    }
    const g = this.geo;
    const halfDiagCells = Math.hypot(g.hostW, g.hostH) / 2 / g.pitchPx;
    p.duration = req.duration ?? clamp(1.2 * halfDiagCells / p.speed, 0.8, 4);
    p.minor = false;
    this.pulses.add(p);
  }
  /**
   * Queues a forced lift (resolved to cells at the next update, when geometry is current).
   * Ignored under reduced motion: the user's accessibility preference wins over the caller.
   */
  lift(req) {
    if (this.destroyed || this.reducedMotion || this.forcedCount >= FORCED_QUEUE) return;
    const o = this.forcedCount++ * 5;
    this.forced[o] = SPACE_CODE[req.space ?? "host"] ?? SPACE_HOST;
    this.forced[o + 1] = req.x;
    this.forced[o + 2] = req.y;
    this.forced[o + 3] = Math.max(1, Math.min(32, Math.floor(req.count ?? 1)));
    this.forced[o + 4] = req.radius ?? Number.NaN;
  }
  /** Cell (relative to the center cell) under a point, written into `out` [ci, cj]. */
  cellAt(space, x, y, out) {
    const g = this.geo;
    let px;
    let py;
    switch (space) {
      case SPACE_NORM:
        px = g.hostX + x * g.hostW;
        py = g.hostY + y * g.hostH;
        break;
      case SPACE_CELLS:
        out[0] = Math.round(x) - (g.cols - 1) / 2;
        out[1] = Math.round(y) - (g.rows - 1) / 2;
        return;
      case SPACE_CLIENT:
        px = g.hostX + (x - this.clientX) * g.sx;
        py = g.hostY + (y - this.clientY) * g.sy;
        break;
      default:
        px = g.hostX + x * g.sx;
        py = g.hostY + y * g.sy;
    }
    out[0] = Math.floor((px - g.originX) / g.pitchPx) - g.pad - (g.cols - 1) / 2;
    out[1] = Math.floor((py - g.originY) / g.pitchPx) - g.pad - (g.rows - 1) / 2;
  }
  /** Something lives in `client` space: the DOM layer must report the host's client origin. */
  get needsClientOrigin() {
    if (this.influences.needsClientOrigin || this.pulses.needsClientOrigin) return true;
    for (let i = 0; i < this.forcedCount; i++) {
      if (this.forced[i * 5] === SPACE_CLIENT) return true;
    }
    return false;
  }
  /** Cell size in host CSS px (for converting cell-based sizes in DOM code). */
  get cellCss() {
    return this.geo.pitchPx / this.geo.sx;
  }
  // -------------------------------------------------------------------------------------------
  // Environment
  setViewport(v) {
    const g = this.geoIn;
    g.hostCssW = Math.max(1, v.hostCssW);
    g.hostCssH = Math.max(1, v.hostCssH);
    g.dpr = v.dpr > 0 ? v.dpr : 1;
    g.deviceW = v.deviceW;
    g.deviceH = v.deviceH;
    this.hasViewport = true;
    this.updateGeometry();
  }
  /** Host padding-box origin in client px (for `client` space); set in the DOM measure phase. */
  setClientOrigin(x, y) {
    this.clientX = x;
    this.clientY = y;
  }
  /** Extra pixel budget cap in megapixels (coarse pointer 2.4, software GL 0.5). */
  setPixelCap(mpx) {
    this.pixelCap = mpx > 0 ? mpx : Number.POSITIVE_INFINITY;
    this.updateGeometry();
  }
  /**
   * Largest drawing-buffer side the GL context supports (device px, 0 = unknown). The canvas is
   * scaled down proportionally so neither side exceeds it.
   */
  setMaxDrawableSize(px) {
    const v = px > 0 && Number.isFinite(px) ? Math.floor(px) : 0;
    if (v === this.geoIn.maxDim) return;
    this.geoIn.maxDim = v;
    this.updateGeometry();
  }
  /**
   * Reduced motion (render.reducedMotion 'respect' + the OS setting): the clock slows down and
   * every lift is off, random ones and forced ones (lift() calls, pointer hover) alike.
   */
  setReducedMotion(on) {
    this.reducedMotion = on;
    if (on) this.forcedCount = 0;
  }
  get isReducedMotion() {
    return this.reducedMotion;
  }
  /** Software GL: lowest tier, no adaptation. */
  setSoftwareFallback(on) {
    this.software = on;
    this.perf.setMode(on ? "low" : this.config.render.quality);
    this.updateGeometry();
  }
  setDebugView(v) {
    this.frame.debugView = v | 0;
  }
  /** Feeds frame timing to the adaptive quality controller. */
  samplePerf(deltaMs, cpuMs, gpuMs, now) {
    const ch = this.perf.sample(deltaMs, cpuMs, gpuMs, now);
    if (ch) this.updateGeometry();
    return ch;
  }
  /** The engine was recreated (context restore): everything must be uploaded again. */
  invalidateGpu() {
    this.frame.paramsDirty = true;
    this.frame.lutDirty = true;
    this.frame.lifeReset = true;
  }
  /** The engine drew the last FrameInputs: one-shot flags are consumed. */
  commitFrame() {
    const f = this.frame;
    f.paramsDirty = false;
    f.lutDirty = false;
    f.lifeReset = false;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.influences.clear();
    this.pulses.clear();
    this.lifts.clear();
    this.forcedCount = 0;
  }
  // -------------------------------------------------------------------------------------------
  // Frame
  /** Advances everything by `dt` seconds and fills the preallocated FrameInputs. */
  update(dt, _now = 0) {
    const f = this.frame;
    const fr = f.frame;
    if (this.destroyed) return f;
    const step = dt > 0 ? dt < 0.1 ? dt : 0.1 : 0;
    const s = this.store;
    const ids = this.ids;
    s.update(step);
    if (s.dirty) {
      f.paramsDirty = true;
      s.dirty = false;
    }
    this.lut.update(step);
    if (this.lut.dirty) {
      f.lutDirty = true;
      this.lut.dirty = false;
    }
    const sizing = this.sizingMix.step(step);
    if (sizing || s.isLive(ids.count) || s.isLive(ids.pitch) || s.isLive(ids.maxDpr) || s.isLive(ids.maxPixels)) {
      this.updateGeometry();
    }
    const g = this.geo;
    const r = this.rates;
    const rm = this.reducedMotion;
    r.speed = Math.max(0, s.num(ids.speed)) * (rm ? 0.15 : 1);
    r.flow = s.num(ids.flowSpeed);
    r.sphereRotation = s.num(ids.rotation);
    r.sphereBreathe = s.num(ids.breathe);
    r.pulse = s.num(ids.pulseSpeed);
    r.wave = s.num(ids.waveSpeed);
    r.vortex = s.num(ids.vortexSpeed);
    r.rain = s.num(ids.rainSpeed);
    r.drift = s.num(ids.drift);
    r.lifeRate = s.num(ids.lifeWeight) > 1e-3 ? s.num(ids.lifeRate) : 0;
    r.sparsity = 1 / Math.max(s.num(ids.sparsityPeriod), 0.1);
    r.flicker = Math.max(0, s.num(ids.flickerRate));
    r.sparkle = 1 / Math.max(s.num(ids.sparkleDuration), 0.05);
    r.ripple = 1 / Math.max(s.num(ids.rippleLife), 0.1);
    const c = this.clock;
    c.advance(step, r);
    f.lifeSteps = c.lifeSteps;
    f.lifeSeed = f.lifeSeed + c.lifeSteps >>> 0;
    f.lifeRule = s.num(ids.lifeRule);
    f.lifeBirth = s.num(ids.lifeBirth);
    f.lifeSeedDensity = s.num(ids.lifeDensity);
    const ic = this.infCtx;
    ic.clientX = this.clientX;
    ic.clientY = this.clientY;
    ic.defaultStrength = s.num(ids.infStrength);
    ic.defaultFalloff = s.num(ids.infFalloff);
    const nInf = this.influences.step(step, ic, fr);
    const lp = this.fillLiftParams();
    if (rm) this.forcedCount = 0;
    else this.drainForced(lp);
    const nLift = this.lifts.step(step, lp, g, fr);
    const nPulse = this.pulses.step(step, g, this.clientX, this.clientY, fr);
    fr[OFF_PHASE_A] = c.flow;
    fr[OFF_PHASE_A + 1] = c.sphereRotation;
    fr[OFF_PHASE_A + 2] = c.sphereBreathe;
    fr[OFF_PHASE_A + 3] = c.pulse;
    fr[OFF_PHASE_B] = c.wave;
    fr[OFF_PHASE_B + 1] = c.vortex;
    fr[OFF_PHASE_B + 2] = c.rain;
    fr[OFF_PHASE_B + 3] = c.drift;
    fr[OFF_CLOCK] = c.seconds;
    fr[OFF_CLOCK + 1] = c.lifeAcc;
    fr[OFF_CLOCK + 2] = s.num(ids.energy);
    fr[OFF_CLOCK + 3] = rm ? 1 : 0;
    fr[OFF_GRID] = g.cols;
    fr[OFF_GRID + 1] = g.rows;
    fr[OFF_GRID + 2] = g.pitchPx;
    fr[OFF_GRID + 3] = g.pad;
    fr[OFF_ORIGIN] = g.originX;
    fr[OFF_ORIGIN + 1] = g.originY;
    fr[OFF_ORIGIN + 2] = g.canvasW;
    fr[OFF_ORIGIN + 3] = g.canvasH;
    fr[OFF_HOST] = g.hostX;
    fr[OFF_HOST + 1] = g.hostY;
    fr[OFF_HOST + 2] = g.hostW;
    fr[OFF_HOST + 3] = g.hostH;
    fr[OFF_SPACE] = g.centerX;
    fr[OFF_SPACE + 1] = g.centerY;
    fr[OFF_SPACE + 2] = 1 / g.halfMin;
    fr[OFF_SPACE + 3] = g.pitchPx / g.halfMin;
    fr[OFF_COUNTS] = nInf;
    fr[OFF_COUNTS + 1] = nPulse;
    fr[OFF_COUNTS + 2] = nLift;
    fr[OFF_COUNTS + 3] = f.debugView;
    fr[OFF_MISC] = s.crossfadePrev(ids.mapping);
    fr[OFF_MISC + 1] = s.crossfadeMix(ids.mapping);
    fr[OFF_MISC + 2] = this.software ? 1 : 0;
    fr[OFF_MISC + 3] = r.drift !== 0 || c.drift !== 0 ? 1 : 0;
    writeEpochPhase(fr, OFF_EPOCH_A, c.sparsity);
    writeEpochPhase(fr, OFF_EPOCH_A + 2, c.sparkle);
    writeEpochPhase(fr, OFF_EPOCH_B, c.flicker);
    writeEpochPhase(fr, OFF_EPOCH_B + 2, c.ripple);
    f.canvasWidth = g.canvasW;
    f.canvasHeight = g.canvasH;
    f.cols = g.cols;
    f.rows = g.rows;
    f.pad = g.pad;
    f.pitchPx = g.pitchPx;
    f.liftCount = nLift;
    f.bloomSigma = s.num(ids.bloomSigma);
    f.hazeSigma = s.num(ids.hazeSigma);
    f.bloomStrength = s.num(ids.bloomStrength);
    f.hazeStrength = s.num(ids.hazeStrength);
    f.quality = this.perf.quality;
    f.opaque = this.config.render.overflow <= 0;
    return f;
  }
  /** Whether anything still moves without new input (tweens, LUT, pulses, lifts). */
  get settling() {
    return this.store.animating || this.lut.transitioning || this.pulses.count > 0 || this.lifts.count > 0;
  }
  // -------------------------------------------------------------------------------------------
  warn(code, message) {
    this.onWarn?.(code, message);
  }
  commit(next, opts) {
    const changed = diffConfigs(this.config, next);
    if (changed.length === 0) return changed;
    this.config = next;
    const dur = Math.max(0, opts.transition ?? next.transition);
    let lut = false;
    for (const path of changed) {
      const field = getField(path);
      if (!field) continue;
      const value = getPath(next, path);
      switch (field.live) {
        case "lut":
          lut = true;
          break;
        case "restart":
          this.store.setTarget(path, value, 0);
          this.frame.lifeReset = true;
          break;
        case "static":
          this.store.setTarget(path, value, 0);
          if (path === "render.quality" && !this.software) {
            this.perf.setMode(value);
          }
          break;
        default:
          this.store.setTarget(path, value, dur);
          if (path === "grid.sizing") this.sizingMix.set(value === "pitch" ? 1 : 0, dur);
      }
    }
    if (lut) this.lut.setTarget(next.color.palette, next.color.interpolation, dur);
    this.updateGeometry();
    return changed;
  }
  fillLiftParams() {
    const s = this.store;
    const ids = this.ids;
    const p = this.liftParams;
    const lift2 = this.config.lift;
    p.enabled = lift2.enabled && !this.reducedMotion;
    p.style = lift2.style === "float" ? 1 : 0;
    p.amount = s.num(ids.liftAmount);
    p.max = s.num(ids.liftMax);
    p.scale = s.num(ids.liftScale);
    p.height = s.num(ids.liftHeight);
    p.parallax = s.num(ids.liftParallax);
    p.tilt = s.num(ids.liftTilt);
    p.holdMin = s.num(ids.liftHoldMin);
    p.holdMax = s.num(ids.liftHoldMax);
    p.rise = s.num(ids.liftRise);
    p.fall = s.num(ids.liftFall);
    p.bokeh = s.num(ids.liftBokeh);
    p.socket = s.num(ids.liftSocket);
    p.outerBias = s.num(ids.liftOuterBias);
    p.cluster = s.num(ids.liftCluster);
    p.landing = s.num(ids.liftLanding);
    p.floatSpeed = s.num(ids.liftFloatSpeed);
    p.floatDrift = s.num(ids.liftFloatDrift);
    p.sceneX = s.comp(ids.center, 0);
    p.sceneY = s.comp(ids.center, 1);
    p.zoom = s.num(ids.zoom);
    return p;
  }
  drainForced(p) {
    const n = this.forcedCount;
    if (n === 0) return;
    this.forcedCount = 0;
    const q = this.forced;
    const cell = this.tmp;
    for (let i = 0; i < n; i++) {
      const o = i * 5;
      this.cellAt(q[o], q[o + 1], q[o + 2], cell);
      const count = q[o + 3];
      const radius = q[o + 4];
      this.lifts.force(
        cell[0],
        cell[1],
        count,
        Number.isNaN(radius) ? Math.max(1, Math.sqrt(count)) : radius,
        p,
        this.geo
      );
    }
  }
  updateGeometry() {
    const s = this.store;
    const ids = this.ids;
    const gi = this.geoIn;
    const cfg = this.config;
    gi.overflowCss = cfg.render.overflow;
    gi.maxDpr = s.num(ids.maxDpr);
    gi.maxPixels = this.nativeResolution ? Number.POSITIVE_INFINITY : Math.min(s.num(ids.maxPixels), this.pixelCap);
    gi.scale = this.perf.scale;
    const countPitch = Math.min(gi.hostCssW, gi.hostCssH) / Math.max(1, s.num(ids.count));
    const fixedPitch = Math.max(1, s.num(ids.pitch));
    const m = this.sizingMix.cur;
    gi.cssPitch = m <= 0 ? countPitch : m >= 1 ? fixedPitch : Math.exp(Math.log(countPitch) * (1 - m) + Math.log(fixedPitch) * m);
    if (this.nativeResolution && this.nativeGridPitch > 0) {
      gi.cssPitch = this.nativeGridPitch;
    }
    gi.alignWholeCellsY = this.nativeResolution && this.nativeGridAlignY;
    gi.alignWholeCellsX = this.nativeResolution && this.nativeGridAlignX;
    gi.fractionalPitch = this.nativeResolution && this.nativeGridFractionalPitch;
    gi.maxGridCells = this.nativeResolution ? Math.max(64, this.nativeGridMaxCells) : void 0;
    if (computeGeometry(gi, this.geo)) this.geometryChanged = true;
  }
  /** Has the DOM layer reported a size yet? */
  get measured() {
    return this.hasViewport;
  }
};
function resolveIds(s) {
  return {
    speed: s.id("animation.speed"),
    energy: s.id("animation.energy"),
    flowSpeed: s.id("modes.flow.speed"),
    rotation: s.id("modes.sphere.rotationSpeed"),
    breathe: s.id("modes.sphere.breatheSpeed"),
    pulseSpeed: s.id("modes.pulse.speed"),
    waveSpeed: s.id("modes.wave.speed"),
    vortexSpeed: s.id("modes.vortex.speed"),
    rainSpeed: s.id("modes.rain.speed"),
    drift: s.id("color.drift"),
    sparsityPeriod: s.id("animation.sparsity.period"),
    flickerRate: s.id("animation.flicker.rate"),
    sparkleDuration: s.id("animation.sparkle.duration"),
    rippleLife: s.id("modes.ripple.life"),
    lifeWeight: s.id("modes.life.weight"),
    lifeRate: s.id("modes.life.stepRate"),
    lifeBirth: s.id("modes.life.birthRate"),
    lifeDensity: s.id("modes.life.seedDensity"),
    lifeRule: s.id("modes.life.rule"),
    mapping: s.id("color.mapping"),
    bloomSigma: s.id("glow.bloom.radius"),
    hazeSigma: s.id("glow.haze.radius"),
    bloomStrength: s.id("glow.bloom.strength"),
    hazeStrength: s.id("glow.haze.strength"),
    pitch: s.id("grid.pitch"),
    count: s.id("grid.count"),
    maxDpr: s.id("render.maxDpr"),
    maxPixels: s.id("render.maxPixels"),
    center: s.id("scene.center"),
    zoom: s.id("scene.zoom"),
    infStrength: s.id("interaction.influenceStrength"),
    infFalloff: s.id("interaction.influenceFalloff"),
    rippleStrength: s.id("interaction.rippleStrength"),
    rippleSpeed: s.id("interaction.rippleSpeed"),
    rippleWidth: s.id("interaction.rippleWidth"),
    liftAmount: s.id("lift.amount"),
    liftMax: s.id("lift.max"),
    liftScale: s.id("lift.scale"),
    liftHeight: s.id("lift.height"),
    liftParallax: s.id("lift.parallax"),
    liftTilt: s.id("lift.tilt"),
    liftHoldMin: s.id("lift.holdMin"),
    liftHoldMax: s.id("lift.holdMax"),
    liftRise: s.id("lift.rise"),
    liftFall: s.id("lift.fall"),
    liftBokeh: s.id("lift.bokeh"),
    liftSocket: s.id("lift.socket"),
    liftOuterBias: s.id("lift.outerBias"),
    liftCluster: s.id("lift.cluster"),
    liftLanding: s.id("lift.landing"),
    liftFloatSpeed: s.id("lift.floatSpeed"),
    liftFloatDrift: s.id("lift.floatDrift")
  };
}
function deadInfluence() {
  const noop = () => {
  };
  return { id: -1, active: false, update: noop, dispose: noop, [Symbol.dispose]: noop };
}

// artifacts/ribbon/vendor/lumicells/src/core/gl/caps.ts
var SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|mesa offscreen/i;
var IMMEDIATE_RE = /nvidia|geforce|quadro|radeon|\bamd\b|\bati\b|intel/i;
function isTiledRenderer(renderer) {
  return !IMMEDIATE_RE.test(renderer) && !SOFTWARE_RE.test(renderer);
}
function readRenderer(gl) {
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const unmasked = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null;
  const plain = gl.getParameter(gl.RENDERER);
  return String(unmasked ?? plain ?? "");
}
function isRenderable(gl, f) {
  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();
  if (!tex || !fb) return false;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, f.internalFormat, 4, 4, 0, f.format, f.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteFramebuffer(fb);
  gl.deleteTexture(tex);
  return ok;
}
function probeCaps(gl, forceRgba8 = false) {
  const rgba8 = {
    internalFormat: gl.RGBA8,
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE
  };
  const half = {
    internalFormat: gl.RGBA16F,
    format: gl.RGBA,
    type: gl.HALF_FLOAT
  };
  const floatExt = gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float");
  const hdr = !forceRgba8 && !!floatExt && isRenderable(gl, half);
  const packed = {
    internalFormat: gl.R11F_G11F_B10F,
    format: gl.RGB,
    type: gl.HALF_FLOAT
  };
  const glowPacked = hdr && isRenderable(gl, packed);
  const renderer = readRenderer(gl);
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
  const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const maxViewportDims = [Number(vp?.[0] ?? 0), Number(vp?.[1] ?? 0)];
  let maxDrawableSize = Number.POSITIVE_INFINITY;
  for (const v of [maxTextureSize, maxRenderbufferSize, maxViewportDims[0], maxViewportDims[1]]) {
    if (v > 0 && Number.isFinite(v)) maxDrawableSize = Math.min(maxDrawableSize, v);
  }
  return {
    hdr,
    hdrFormat: hdr ? half : rgba8,
    glowFormat: glowPacked ? packed : hdr ? half : rgba8,
    rgba8,
    parallelCompile: gl.getExtension("KHR_parallel_shader_compile"),
    timerQuery: gl.getExtension("EXT_disjoint_timer_query_webgl2"),
    loseContext: gl.getExtension("WEBGL_lose_context"),
    maxTextureSize,
    maxRenderbufferSize,
    maxViewportDims,
    // 0 = unknown (a driver that reports nothing): no clamp.
    maxDrawableSize: Number.isFinite(maxDrawableSize) ? maxDrawableSize : 0,
    maxDrawBuffers: gl.getParameter(gl.MAX_DRAW_BUFFERS),
    maxUniformBlockSize: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
    renderer,
    software: SOFTWARE_RE.test(renderer),
    tiled: isTiledRenderer(renderer)
  };
}

// artifacts/ribbon/vendor/lumicells/src/core/gl/program.ts
var ShaderError = class extends Error {
  constructor(message, log, source) {
    super(message);
    this.log = log;
    this.source = source;
    this.name = "ShaderError";
  }
  log;
  source;
};
function numbered(source) {
  return source.split("\n").map((line, i) => `${String(i + 1).padStart(4, " ")}| ${line}`).join("\n");
}
function excerpt(source, log) {
  const lines = source.split("\n");
  const out = [];
  const re = /\d+:(\d+):/g;
  const seen = /* @__PURE__ */ new Set();
  for (let m = re.exec(log); m && out.length < 6; m = re.exec(log)) {
    const n = Number(m[1]);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(`${String(n).padStart(4, " ")}| ${lines[n - 1] ?? ""}`);
  }
  return out.join("\n");
}
function wrapProgram(gl, handle, label) {
  const cache = /* @__PURE__ */ new Map();
  return {
    handle,
    label,
    uniform(name) {
      let loc = cache.get(name);
      if (loc === void 0) {
        loc = gl.getUniformLocation(handle, name);
        cache.set(name, loc);
      }
      return loc;
    },
    bindBlock(name, binding) {
      const index = gl.getUniformBlockIndex(handle, name);
      if (index !== gl.INVALID_INDEX) gl.uniformBlockBinding(handle, index, binding);
    },
    dispose() {
      gl.deleteProgram(handle);
      cache.clear();
    }
  };
}
function createProgramAsync(gl, vertexSource, fragmentSource, label, parallel) {
  const vs2 = gl.createShader(gl.VERTEX_SHADER);
  const fs2 = gl.createShader(gl.FRAGMENT_SHADER);
  const handle = gl.createProgram();
  if (!vs2 || !fs2 || !handle) {
    throw new ShaderError(`[lumicells] cannot create program "${label}"`, "");
  }
  gl.shaderSource(vs2, vertexSource);
  gl.shaderSource(fs2, fragmentSource);
  gl.compileShader(vs2);
  gl.compileShader(fs2);
  gl.attachShader(handle, vs2);
  gl.attachShader(handle, fs2);
  gl.linkProgram(handle);
  let result = null;
  let done = false;
  const cleanup = (deleteProgram) => {
    if (done) return;
    done = true;
    gl.deleteShader(vs2);
    gl.deleteShader(fs2);
    if (deleteProgram) gl.deleteProgram(handle);
  };
  const fail = () => {
    let message = `[lumicells] program "${label}" failed to link`;
    let log = gl.getProgramInfoLog(handle) ?? "";
    let source;
    for (const [shader, src, kind] of [
      [vs2, vertexSource, "vert"],
      [fs2, fragmentSource, "frag"]
    ]) {
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        log = gl.getShaderInfoLog(shader) ?? "";
        message = `[lumicells] shader "${label}.${kind}" failed to compile:
${log}
${excerpt(src, log)}`;
        source = numbered(src);
        break;
      }
    }
    cleanup(true);
    throw new ShaderError(message, log, source);
  };
  return {
    label,
    poll() {
      if (result) return result;
      if (done) return null;
      if (gl.isContextLost()) return null;
      if (parallel && !gl.getProgramParameter(handle, parallel.COMPLETION_STATUS_KHR)) return null;
      if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) fail();
      cleanup(false);
      result = wrapProgram(gl, handle, label);
      return result;
    },
    dispose() {
      if (result) {
        result.dispose();
        result = null;
        done = true;
        return;
      }
      cleanup(true);
    }
  };
}

// artifacts/ribbon/vendor/lumicells/src/core/gl/target.ts
function createTexture(gl, width, height, { filter = gl.NEAREST, wrap: wrap2 = gl.CLAMP_TO_EDGE, format } = {}, data = null) {
  const tex = gl.createTexture();
  if (!tex) throw new Error("[lumicells] cannot create texture");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap2);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap2);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    format?.internalFormat ?? gl.RGBA8,
    width,
    height,
    0,
    format?.format ?? gl.RGBA,
    format?.type ?? gl.UNSIGNED_BYTE,
    data
  );
  return tex;
}
function checkComplete(gl) {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    throw new Error(`[lumicells] framebuffer incomplete: 0x${status.toString(16)}`);
  }
}
function createMrtFramebuffer(gl, textures) {
  const fb = gl.createFramebuffer();
  if (!fb) throw new Error("[lumicells] cannot create framebuffer");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const buffers = [];
  for (let i = 0; i < textures.length; i++) {
    const attachment = gl.COLOR_ATTACHMENT0 + i;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, textures[i] ?? null, 0);
    buffers.push(attachment);
  }
  gl.drawBuffers(buffers);
  checkComplete(gl);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}
function bucketSize(n, step = 32) {
  return Math.max(step, Math.ceil(Math.max(1, n) / step) * step);
}
function needsRealloc(alloc, need, step = 32) {
  return need > alloc || bucketSize(need, step) * 2 < alloc;
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/params.ts
var PARAM_MACRO_DEFAULTS = [
  ["P_grid_gap", "0.27"],
  ["P_grid_roundness", "0.3"],
  ["P_grid_softness", "0.6"],
  ["P_grid_emitter", "0.18"],
  ["P_grid_bevel", "0.0"],
  ["P_scene_center", "vec2(-0.02, -0.02)"],
  ["P_scene_zoom", "1.0"],
  ["P_animation_blend", "0.0"],
  ["P_animation_brightness", "1.0"],
  ["P_animation_gamma", "1.15"],
  ["P_animation_floor", "0.16"],
  ["P_animation_energy", "1.0"],
  ["P_animation_flicker_amount", "0.4"],
  ["P_animation_flicker_rate", "0.3"],
  ["P_animation_sparkle_amount", "0.35"],
  ["P_animation_sparkle_rate", "0.008"],
  ["P_animation_sparkle_duration", "0.5"],
  ["P_animation_sparsity_amount", "0.55"],
  ["P_animation_sparsity_period", "3.0"],
  ["P_modes_flow_weight", "0.1"],
  ["P_modes_flow_scale", "1.6"],
  ["P_modes_flow_direction", "0.5235988"],
  ["P_modes_flow_threshold", "0.45"],
  ["P_modes_flow_softness", "0.3"],
  ["P_modes_sphere_weight", "1.0"],
  ["P_modes_sphere_radius", "0.68"],
  ["P_modes_sphere_shift", "vec2(0.02, 0.16)"],
  ["P_modes_sphere_hole", "0.25"],
  ["P_modes_sphere_holeSoftness", "0.12"],
  ["P_modes_sphere_rimPower", "1.3"],
  ["P_modes_sphere_outerFalloff", "0.38"],
  ["P_modes_sphere_lightAngle", "3.4906585"],
  ["P_modes_sphere_lightStrength", "0.45"],
  ["P_modes_sphere_tilt", "0.3490659"],
  ["P_modes_sphere_surface", "0.55"],
  ["P_modes_sphere_surfaceScale", "2.5"],
  ["P_modes_sphere_wobble", "0.08"],
  ["P_modes_sphere_breathe", "0.025"],
  ["P_modes_sphere_fadeAngle", "6.0213859"],
  ["P_modes_sphere_fadeAmount", "1.0"],
  ["P_modes_pulse_weight", "0.0"],
  ["P_modes_pulse_frequency", "3.0"],
  ["P_modes_pulse_width", "0.14"],
  ["P_modes_pulse_breathe", "0.35"],
  ["P_modes_pulse_falloff", "1.0"],
  ["P_modes_pulse_origin", "vec2(0.0, 0.0)"],
  ["P_modes_wave_weight", "0.0"],
  ["P_modes_wave_angle", "0.3490659"],
  ["P_modes_wave_frequency", "2.5"],
  ["P_modes_wave_sharpness", "0.35"],
  ["P_modes_wave_interference", "0.5"],
  ["P_modes_ripple_weight", "0.0"],
  ["P_modes_ripple_rate", "1.2"],
  ["P_modes_ripple_speed", "0.4"],
  ["P_modes_ripple_width", "0.09"],
  ["P_modes_ripple_life", "2.5"],
  ["P_modes_vortex_weight", "0.0"],
  ["P_modes_vortex_arms", "3.0"],
  ["P_modes_vortex_twist", "3.0"],
  ["P_modes_vortex_falloff", "0.9"],
  ["P_modes_vortex_sharpness", "0.4"],
  ["P_modes_life_weight", "0.0"],
  ["P_modes_life_fadeSteps", "4.0"],
  ["P_modes_rain_weight", "0.0"],
  ["P_modes_rain_density", "0.25"],
  ["P_modes_rain_tail", "0.5"],
  ["P_modes_rain_angle", "0.0"],
  ["P_color_mapping", "0.0"],
  ["P_color_angle", "0.3839724"],
  ["P_color_bend", "0.35"],
  ["P_color_scale", "1.0"],
  ["P_color_offset", "0.0"],
  ["P_color_warp", "0.12"],
  ["P_color_warpScale", "1.3"],
  ["P_color_jitter", "0.12"],
  ["P_color_intensityShift", "0.12"],
  ["P_color_saturation", "1.05"],
  ["P_color_hot_amount", "0.15"],
  ["P_color_hot_threshold", "0.92"],
  ["P_color_hot_core", "0.8"],
  ["P_color_accent_color", "vec3(0.0060, 0.5271, 0.6867)"],
  ["P_color_accent_amount", "0.9"],
  ["P_background_color", "vec3(0.0, 0.0, 0.0319)"],
  ["P_background_vignette", "0.35"],
  ["P_background_spotA_color", "vec3(0.1441, 0.0137, 0.1559)"],
  ["P_background_spotA_position", "vec2(-1.3, -0.2)"],
  ["P_background_spotA_radius", "1.25"],
  ["P_background_spotA_strength", "0.65"],
  ["P_background_spotB_color", "vec3(0.0080, 0.0144, 0.2086)"],
  ["P_background_spotB_position", "vec2(-0.8, 1.1)"],
  ["P_background_spotB_radius", "0.9"],
  ["P_background_spotB_strength", "0.5"],
  ["P_glow_halo_strength", "0.5"],
  ["P_glow_halo_radius", "0.18"],
  ["P_glow_bloom_strength", "0.8"],
  ["P_glow_bloom_threshold", "0.35"],
  ["P_glow_bloom_knee", "0.5"],
  ["P_glow_haze_strength", "0.12"],
  ["P_glow_saturation", "1.15"],
  ["P_glow_exposure", "1.0"],
  ["P_glow_whitePoint", "4.0"],
  ["P_lift_brightness", "0.9"],
  ["P_lift_whiten", "0.12"],
  ["P_lift_shadow", "0.4"],
  ["P_lift_halo", "0.8"],
  ["E_animation_blend_screen", "0.0"],
  ["E_animation_blend_add", "1.0"],
  ["E_animation_blend_max", "2.0"],
  ["E_color_mapping_spatial", "0.0"],
  ["E_color_mapping_radial", "1.0"],
  ["E_color_mapping_angular", "2.0"],
  ["E_color_mapping_intensity", "3.0"],
  ["E_color_mapping_noise", "4.0"]
];
var PARAM_DEFAULTS_GLSL = PARAM_MACRO_DEFAULTS.map(
  ([name, value]) => `#ifndef ${name}
#define ${name} ${value}
#endif`
).join("\n");
function missingParamMacros(prelude) {
  const defined = /* @__PURE__ */ new Set();
  const re = /#define\s+([A-Za-z_]\w*)/g;
  for (let m = re.exec(prelude); m; m = re.exec(prelude)) {
    if (m[1]) defined.add(m[1]);
  }
  return PARAM_MACRO_DEFAULTS.map(([name]) => name).filter((name) => !defined.has(name));
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/gpu-timer.ts
var MAX_PLAUSIBLE_MS = 1e3;
var GpuTimer = class {
  constructor(gl, ext, size = 4) {
    this.gl = gl;
    this.ext = ext;
    for (let i = 0; i < size; i++) {
      const q = gl.createQuery();
      if (!q) break;
      this.queries.push(q);
      this.pending.push(false);
      this.tainted.push(false);
    }
  }
  gl;
  ext;
  queries = [];
  pending = [];
  /** In flight while a disjoint event was reported: the result is dropped on arrival. */
  tainted = [];
  /** Slot the next query uses; while it is pending it holds the oldest query in flight. */
  head = 0;
  active = false;
  /** Newest valid GPU time of a frame in ms, or null before the first result. */
  ms = null;
  /** Collects finished results, then starts timing this frame (skipped while the ring is full). */
  begin() {
    const gl = this.gl;
    const n = this.queries.length;
    if (n === 0) return;
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      for (let i = 0; i < n; i++) if (this.pending[i]) this.tainted[i] = true;
    }
    for (let k = 0; k < n; k++) {
      const i = (this.head + k) % n;
      const q2 = this.queries[i];
      if (!q2 || !this.pending[i]) continue;
      if (!gl.getQueryParameter(q2, gl.QUERY_RESULT_AVAILABLE)) continue;
      const ns = Number(gl.getQueryParameter(q2, gl.QUERY_RESULT));
      this.pending[i] = false;
      const tainted = this.tainted[i];
      this.tainted[i] = false;
      const ms = ns / 1e6;
      if (!tainted && Number.isFinite(ms) && ms >= 0 && ms < MAX_PLAUSIBLE_MS) this.ms = ms;
    }
    const q = this.queries[this.head];
    if (!q || this.pending[this.head]) return;
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = true;
  }
  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.active = false;
    this.pending[this.head] = true;
    this.head = (this.head + 1) % this.queries.length;
  }
  dispose() {
    if (this.active) this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.active = false;
    for (const q of this.queries) this.gl.deleteQuery(q);
    this.queries.length = 0;
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/common.ts
var COMMON_GLSL = (
  /* glsl */
  `
#define PI 3.14159265
#define TAU 6.28318531

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec2 sat2(vec2 x) { return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x) { return clamp(x, 0.0, 1.0); }
float sq(float x) { return x * x; }
vec3 sq3(vec3 x) { return x * x; }
float max3(vec3 c) { return max(c.r, max(c.g, c.b)); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 saturateColor(vec3 c, float s) { return max(vec3(0.0), mix(vec3(luma(c)), c, s)); }
// Mirrored repeat: identity on [0,1], folds back outside (seamless palette cycling).
float tri(float x) { return 1.0 - abs(fract(x * 0.5) * 2.0 - 1.0); }
// Fades a periodic feature out as it approaches the cell Nyquist limit (x = cycles per cell).
float bandLimit(float x) { return sat(1.0 - (x - 0.25) * 5.0); }

// ---- Integer hashes (PCG). Never sin-hashes: those break at large inputs on mobile GPUs.
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
uint hash2(uvec2 v) { return pcg(v.x + pcg(v.y)); }
uint hash3(uvec3 v) { return pcg(v.x + pcg(v.y + pcg(v.z))); }
// 24 random bits -> [0,1) without rounding up to 1.0.
float u01(uint h) { return float(h >> 8u) * (1.0 / 16777216.0); }

// ---- Render-target encoding: HDR targets store linear values, RGBA8 stores sqrt(x/4)
// (perceptual precision in the darks, headroom up to 4). Functions, not macros, so a texture
// fetch passed in is evaluated once.
#if HDR_RT
vec4 enc4(vec4 v) { return v; }
vec4 dec4(vec4 v) { return v; }
#define GLOW_SCALE 1.0
#else
vec4 enc4(vec4 v) { return sqrt(clamp(v * 0.25, 0.0, 1.0)); }
vec4 dec4(vec4 v) { return v * v * 4.0; }
// The combined glow already carries strength and saturation (up to ~4x the raw bloom), which
// would clip at enc4's ceiling of 4 and shift hue; RGBA8 stores it pre-divided by this.
#define GLOW_SCALE 4.0
#endif

// ---- Color
vec3 lin2srgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

float cbrt(float x) { return sign(x) * pow(abs(x), 1.0 / 3.0); }

vec3 lin2oklab(vec3 c) {
  float l = cbrt(dot(c, vec3(0.4122214708, 0.5363325363, 0.0514459929)));
  float m = cbrt(dot(c, vec3(0.2119034982, 0.6806995451, 0.1073969566)));
  float s = cbrt(dot(c, vec3(0.0883024619, 0.2817188376, 0.6299787005)));
  return vec3(
    dot(vec3(l, m, s), vec3(0.2104542553, 0.7936177850, -0.0040720468)),
    dot(vec3(l, m, s), vec3(1.9779984951, -2.4285922050, 0.4505937099)),
    dot(vec3(l, m, s), vec3(0.0259040371, 0.7827717662, -0.8086757660)));
}

vec3 oklab2lin(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  vec3 lms = vec3(l * l * l, m * m * m, s * s * s);
  return vec3(
    dot(lms, vec3(4.0767416621, -3.3077115913, 0.2309699292)),
    dot(lms, vec3(-1.2684380046, 2.6097574011, -0.3413193965)),
    dot(lms, vec3(-0.0041960863, -0.7034186147, 1.7076147010)));
}

// Hue-preserving tonemap on the max channel: linear up to the knee, then an extended Reinhard
// shoulder that reaches 1.0 at the white point. Per-channel curves would shift hues and bleach
// saturated neon toward white by accident; whitening is an explicit, spatially limited control.
#define TM_KNEE 0.6
vec3 tonemapMax(vec3 c, float wp) {
  float m = max3(c);
  if (m <= TM_KNEE) return c;
  float x = (m - TM_KNEE) * (1.0 / (1.0 - TM_KNEE));
  float w = max((wp - TM_KNEE) * (1.0 / (1.0 - TM_KNEE)), 0.05);
  float y = x * (1.0 + x / (w * w)) / (1.0 + x);
  return c * ((TM_KNEE + (1.0 - TM_KNEE) * min(y, 1.0)) / m);
}

// ---- mediump variants for the per-pixel color math (GLSL ES cannot overload on precision, and a
// helper without qualifiers takes and returns highp, which promotes the whole expression back to
// FP32). Everything here is a color or a fraction: the ranges fit FP16 with room to spare.
mediump float satM(mediump float x) { return clamp(x, 0.0, 1.0); }
mediump vec3 sat3M(mediump vec3 x) { return clamp(x, 0.0, 1.0); }
mediump vec3 sq3M(mediump vec3 x) { return x * x; }
mediump float max3M(mediump vec3 c) { return max(c.r, max(c.g, c.b)); }
mediump float lumaM(mediump vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
mediump vec3 saturateColorM(mediump vec3 c, mediump float s) {
  return max(vec3(0.0), mix(vec3(lumaM(c)), c, s));
}
mediump vec3 lin2srgbM(mediump vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
mediump vec3 tonemapMaxM(mediump vec3 c, mediump float wp) {
  mediump float m = max3M(c);
  if (m <= TM_KNEE) return c;
  mediump float x = (m - TM_KNEE) * (1.0 / (1.0 - TM_KNEE));
  mediump float w = max((wp - TM_KNEE) * (1.0 / (1.0 - TM_KNEE)), 0.05);
  mediump float y = x * (1.0 + x / (w * w)) / (1.0 + x);
  return c * ((TM_KNEE + (1.0 - TM_KNEE) * min(y, 1.0)) / m);
}

// Triangular-PDF dither of +-1 LSB (8-bit) from one hash: kills banding in the deep navy.
float ditherTPDF(vec2 fragCoord) {
  uint h = hash2(uvec2(ivec2(fragCoord)));
  float a = float(h & 0xffffu) * (1.0 / 65535.0);
  float b = float(h >> 16u) * (1.0 / 65535.0);
  return (a + b - 1.0) * (1.0 / 255.0);
}

// Rounded box SDF: half extents b, corner radius r (inside the box). Negative inside.
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// ---- Cell-space texture sampling. pos is in texel units (centers at i + 0.5), lim is the valid
// (logical) size inside a larger bucketed allocation, inv = 1 / allocation size. Every tap is
// clamped to the valid rect so stale headroom texels never bleed in.
vec4 texBilinear(sampler2D t, vec2 pos, vec2 lim, vec2 inv) {
  return texture(t, clamp(pos, vec2(0.5), lim - 0.5) * inv);
}

// Cubic B-spline in 4 bilinear taps: C2-smooth, so cell-resolution glow shows no diamonds or
// Mach bands when stretched over tens of pixels. Positions stay highp; the weights and the result
// are mediump (they are colors and fractions).
mediump vec4 texBicubic(sampler2D t, vec2 pos, vec2 lim, vec2 inv) {
  vec2 st = pos - 0.5;
  vec2 i = floor(st);
  mediump vec2 f = st - i;
  mediump vec2 f2 = f * f;
  mediump vec2 f3 = f2 * f;
  mediump vec2 w0 = (1.0 / 6.0) * (-f3 + 3.0 * f2 - 3.0 * f + 1.0);
  mediump vec2 w1 = (1.0 / 6.0) * (3.0 * f3 - 6.0 * f2 + 4.0);
  mediump vec2 w2 = (1.0 / 6.0) * (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0);
  mediump vec2 w3 = (1.0 / 6.0) * f3;
  mediump vec2 g0 = w0 + w1;
  mediump vec2 g1 = w2 + w3;
  vec2 lo = vec2(0.5);
  vec2 hi = lim - 0.5;
  vec2 h0 = clamp(i - 0.5 + w1 / g0, lo, hi) * inv;
  vec2 h1 = clamp(i + 1.5 + w3 / g1, lo, hi) * inv;
  return g0.y * (g0.x * texture(t, h0) + g1.x * texture(t, vec2(h1.x, h0.y)))
       + g1.y * (g0.x * texture(t, vec2(h0.x, h1.y)) + g1.x * texture(t, h1));
}

// Decoded (linear) cell-space sampling: texture filtering is only valid on linear data, so on the
// RGBA8 path (sqrt-encoded texels) every texel is fetched and decoded first and the filter runs
// in the shader. Same results as the hardware versions on float targets.
#if HDR_RT
vec4 texBilinearDec(sampler2D t, vec2 pos, vec2 lim, vec2 inv) {
  return texBilinear(t, pos, lim, inv);
}
vec4 texBicubicDec(sampler2D t, vec2 pos, vec2 lim, vec2 inv) {
  return texBicubic(t, pos, lim, inv);
}
#else
vec4 texBilinearDec(sampler2D t, vec2 pos, vec2 lim, vec2 inv) {
  vec2 st = clamp(pos, vec2(0.5), lim - 0.5) - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  ivec2 a = ivec2(i);
  ivec2 b = min(a + 1, ivec2(lim) - 1);
  vec4 t00 = dec4(texelFetch(t, a, 0));
  vec4 t10 = dec4(texelFetch(t, ivec2(b.x, a.y), 0));
  vec4 t01 = dec4(texelFetch(t, ivec2(a.x, b.y), 0));
  vec4 t11 = dec4(texelFetch(t, b, 0));
  return mix(mix(t00, t10, f.x), mix(t01, t11, f.x), f.y);
}
// Cubic B-spline over the 4x4 neighbourhood (16 fetches; the fallback path only).
vec4 texBicubicDec(sampler2D t, vec2 pos, vec2 lim, vec2 inv) {
  vec2 st = pos - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 f2 = f * f;
  vec2 f3 = f2 * f;
  vec2 w[4];
  w[0] = (1.0 / 6.0) * (-f3 + 3.0 * f2 - 3.0 * f + 1.0);
  w[1] = (1.0 / 6.0) * (3.0 * f3 - 6.0 * f2 + 4.0);
  w[2] = (1.0 / 6.0) * (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0);
  w[3] = (1.0 / 6.0) * f3;
  ivec2 base = ivec2(i) - 1;
  ivec2 hi = ivec2(lim) - 1;
  vec4 acc = vec4(0.0);
  for (int y = 0; y < 4; y++) {
    vec4 row = vec4(0.0);
    for (int x = 0; x < 4; x++) {
      row += w[x].x * dec4(texelFetch(t, clamp(base + ivec2(x, y), ivec2(0), hi), 0));
    }
    acc += w[y].y * row;
  }
  return acc;
}
#endif
`
);
var FULLSCREEN_VS = (
  /* glsl */
  `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/shared.ts
var UNIT_LIFE = 0;
var UNIT_LUT = 1;
var UNIT_FIELD_A = 2;
var UNIT_FIELD_B = 3;
var UNIT_GLOW = 4;
var UNIT_HAZE = 5;
var UNIT_SRC = 6;
var UNIT_STAMP_A = 7;
var UNIT_STAMP_B = 8;
var UNIT_LOOKUP_VK = 9;
var UNIT_LOOKUP_MAX = 10;
var BIND_PARAMS = 0;
var BIND_FRAME = 1;
function buildHeader(hdr, paramsPrelude) {
  return `#version 300 es
precision highp float;
precision highp int;
precision mediump sampler2D;
#define HDR_RT ${hdr ? 1 : 0}
${paramsPrelude}
${PARAM_DEFAULTS_GLSL}
${FRAME_BLOCK_GLSL}
${COMMON_GLSL}
`;
}
var LazyProgram = class {
  constructor(ctx, vs2, fs2, label, setup) {
    this.ctx = ctx;
    this.setup = setup;
    this.pending = createProgramAsync(ctx.gl, vs2, fs2, label, ctx.caps.parallelCompile);
  }
  ctx;
  setup;
  pending;
  program = null;
  /** True once linked; throws ShaderError on compile/link failure. */
  poll() {
    if (this.program) return true;
    if (!this.pending) return false;
    const p = this.pending.poll();
    if (!p) return false;
    this.pending = null;
    this.program = p;
    bindProgram(this.ctx.gl, p.handle);
    p.bindBlock("ParamsBlock", BIND_PARAMS);
    p.bindBlock("FrameBlock", BIND_FRAME);
    this.setup(p);
    return true;
  }
  get() {
    if (!this.program) throw new Error("[lumicells] program used before link");
    return this.program;
  }
  /** Binds the program and returns it. */
  use() {
    const p = this.get();
    bindProgram(this.ctx.gl, p.handle);
    return p;
  }
  dispose() {
    this.pending?.dispose();
    this.pending = null;
    this.program?.dispose();
    this.program = null;
  }
};
function bindProgram(gl, handle) {
  gl.useProgram(handle);
}
function setSampler(gl, p, name, unit) {
  const loc = p.uniform(name);
  if (loc) gl.uniform1i(loc, unit);
}
function bindTexture(gl, unit, tex) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}
var DISCARD = [
  [],
  [36064],
  [36064, 36065],
  [36064, 36065, 36066]
];
function discardTargets(ctx, count = 1) {
  if (!ctx.caps.tiled) return;
  ctx.gl.invalidateFramebuffer(ctx.gl.FRAMEBUFFER, DISCARD[count]);
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/bloom.ts
var MAX_TAPS = 9;
var MAX_RADIUS = 2 * (MAX_TAPS - 1);
var BLOOM_SOURCE_GLSL = (
  /* glsl */
  `
// Calibrates bloom.strength = 1 to "the glow of a lit cluster matches its cells" on the default look.
#define BLOOM_GAIN 3.0
float fillFactor() {
  float r = sat(P_grid_roundness);
  return sq(1.0 - P_grid_gap) * (1.0 - 0.43 * r * r);
}
vec3 bloomSource(vec3 e) {
  float m = max3(e);
  float th = P_glow_bloom_threshold;
  float knee = th * P_glow_bloom_knee + 1e-4;
  float s = clamp(m - th + knee, 0.0, 2.0 * knee);
  s = s * s / (4.0 * knee);
  float w = max(s, m - th) / max(m, 1e-4);
  return e * (w * fillFactor() * BLOOM_GAIN);
}
`
);
function downsampleFs(header) {
  return `${header}
uniform sampler2D u_src;   // bloom source (thresholded, fill-scaled emission)
uniform vec4 u_cellTex;
out vec4 o_color;
// Quarter texel j is centered on cell coordinate 4j + 2; an 8-wide tent (1,2,3,4,4,3,2,1)
// around it is alias-free and exact (texelFetch, no filtering of encoded values).
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * 4 - 2;
  ivec2 lim = ivec2(u_cellTex.xy) - 1;
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 8; y++) {
    float wy = 4.5 - abs(float(y) - 3.5);
    for (int x = 0; x < 8; x++) {
      float wx = 4.5 - abs(float(x) - 3.5);
      acc += dec4(texelFetch(u_src, clamp(base + ivec2(x, y), ivec2(0), lim), 0)).rgb * (wx * wy);
    }
  }
  o_color = enc4(vec4(acc * (1.0 / 400.0), 1.0));
}
`;
}
function blurFs(header, dir, combine = false) {
  return `${header}
#define BLUR_DIR ${dir === "x" ? "vec2(1.0, 0.0)" : "vec2(0.0, 1.0)"}
#define BLUR_STEP ${dir === "x" ? "ivec2(1, 0)" : "ivec2(0, 1)"}
#define COMBINE ${combine ? 1 : 0}
uniform sampler2D u_src;
uniform vec4 u_tex;              // xy logical size, zw 1 / allocation
#if HDR_RT
uniform vec2 u_taps[${MAX_TAPS}]; // (offset texels, weight); [0] is the center
uniform int u_count;
#else
uniform float u_w[${MAX_RADIUS + 1}]; // per-texel weights, [0] is the center
uniform int u_radius;
#endif
#if COMBINE
uniform sampler2D u_haze;
uniform vec4 u_hazeTex;          // same for the quarter-res haze
uniform vec3 u_mix;              // x bloom on, y haze on, z vignette on (debug views isolate one)
#endif
out vec4 o_color;
void main() {
#if HDR_RT
  vec2 pos = gl_FragCoord.xy;
  vec3 acc = texBilinear(u_src, pos, u_tex.xy, u_tex.zw).rgb * u_taps[0].y;
  for (int i = 1; i < ${MAX_TAPS}; i++) {
    if (i >= u_count) break;
    vec2 o = BLUR_DIR * u_taps[i].x;
    acc += (texBilinear(u_src, pos + o, u_tex.xy, u_tex.zw).rgb
          + texBilinear(u_src, pos - o, u_tex.xy, u_tex.zw).rgb) * u_taps[i].y;
  }
#else
  // Decode before filtering: every texel is fetched exactly (clamped to the logical rect).
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 lim = ivec2(u_tex.xy) - 1;
  vec3 acc = dec4(texelFetch(u_src, c, 0)).rgb * u_w[0];
  for (int i = 1; i <= ${MAX_RADIUS}; i++) {
    if (i > u_radius) break;
    ivec2 o = BLUR_STEP * i;
    acc += (dec4(texelFetch(u_src, clamp(c + o, ivec2(0), lim), 0)).rgb
          + dec4(texelFetch(u_src, clamp(c - o, ivec2(0), lim), 0)).rgb) * u_w[i];
  }
#endif
#if COMBINE
  // The composite used to B-spline sample bloom (at the pixel) and haze (at pixel / 4) and add
  // them. Haze is wide enough that sampling it at the cell center and letting the composite's
  // single B-spline lookup carry it the rest of the way is indistinguishable; so is the vignette
  // taken per cell (it varies over the whole host).
  vec3 haze = texBicubicDec(u_haze, gl_FragCoord.xy * 0.25, u_hazeTex.xy, u_hazeTex.zw).rgb;
  vec2 cpx = f_origin.xy + gl_FragCoord.xy * f_grid.z;
  vec2 nuv = (cpx - f_space.xy) / max(0.5 * f_host.zw, vec2(1.0));
  float vig = 1.0 - P_background_vignette * smoothstep(0.5, 1.45, length(nuv));
  // Each layer is saturated on its own, as before (the saturation clamps at 0, so clamping the
  // sum instead would let a layer's negative channel eat into the other).
  float gs = P_glow_saturation;
  acc = saturateColor(acc, gs) * (P_glow_bloom_strength * u_mix.x)
      + saturateColor(haze, gs) * (P_glow_haze_strength * u_mix.y * mix(1.0, vig, u_mix.z));
  acc *= 1.0 / GLOW_SCALE;
#endif
  o_color = enc4(vec4(acc, 1.0));
}
`;
}
function kernelRadius(sigma) {
  return Math.min(MAX_RADIUS, Math.max(1, Math.ceil(Math.max(0.05, sigma) * 3)));
}
function gaussianWeights(sigma, out) {
  const s = Math.max(0.05, sigma);
  const radius = kernelRadius(sigma);
  const inv = 1 / (2 * s * s);
  let total = 1;
  for (let i = 1; i <= radius; i++) total += 2 * Math.exp(-i * i * inv);
  for (let i = 0; i <= MAX_RADIUS; i++) out[i] = i <= radius ? Math.exp(-i * i * inv) / total : 0;
  return radius;
}
function gaussianTaps(sigma, out) {
  const s = Math.max(0.05, sigma);
  const radius = kernelRadius(sigma);
  const inv = 1 / (2 * s * s);
  let total = 1;
  for (let i = 1; i <= radius; i++) total += 2 * Math.exp(-i * i * inv);
  out[0] = 0;
  out[1] = 1 / total;
  let n = 1;
  for (let i = 1; i <= radius; i += 2) {
    const wa = Math.exp(-i * i * inv) / total;
    const wb = i + 1 <= radius ? Math.exp(-(i + 1) * (i + 1) * inv) / total : 0;
    const w = wa + wb;
    out[n * 2] = w > 0 ? (i * wa + (i + 1) * wb) / w : i;
    out[n * 2 + 1] = w;
    n++;
  }
  for (let k = n; k < MAX_TAPS; k++) {
    out[k * 2] = 0;
    out[k * 2 + 1] = 0;
  }
  return n;
}
function glowMix(debugView) {
  if (debugView === 3) return [1, 0, 0];
  if (debugView === 4) return [0, 1, 0];
  return [1, 1, 1];
}
var BloomPass = class {
  constructor(ctx) {
    this.ctx = ctx;
    const gl = ctx.gl;
    this.downsample = new LazyProgram(
      ctx,
      FULLSCREEN_VS,
      downsampleFs(ctx.header),
      "haze-downsample",
      (p) => setSampler(gl, p, "u_src", UNIT_SRC)
    );
    const blur = (dir, label, combine = false) => new LazyProgram(ctx, FULLSCREEN_VS, blurFs(ctx.header, dir, combine), label, (p) => {
      setSampler(gl, p, "u_src", UNIT_SRC);
      if (combine) setSampler(gl, p, "u_haze", UNIT_HAZE);
    });
    this.blurs = [
      blur("x", "bloom-x"),
      blur("y", "bloom-y-combine", true),
      blur("x", "haze-x"),
      blur("y", "haze-y")
    ];
  }
  ctx;
  downsample;
  blurs;
  taps = new Float32Array(MAX_TAPS * 2);
  weights = new Float32Array(MAX_RADIUS + 1);
  bloomSigma = -1;
  hazeSigma = -1;
  mixView = -1;
  poll() {
    let ok = this.downsample.poll();
    for (const b of this.blurs) ok = b.poll() && ok;
    return ok;
  }
  /** Forces kernel re-upload (after programs are (re)linked). */
  invalidate() {
    this.bloomSigma = -1;
    this.hazeSigma = -1;
    this.mixView = -1;
  }
  uploadKernel(first, sigma) {
    const gl = this.ctx.gl;
    const hdr = this.ctx.caps.hdr;
    const count = hdr ? gaussianTaps(sigma, this.taps) : gaussianWeights(sigma, this.weights);
    for (let i = first; i < first + 2; i++) {
      const p = this.blurs[i]?.use();
      if (!p) continue;
      if (hdr) {
        gl.uniform2fv(p.uniform("u_taps"), this.taps);
        gl.uniform1i(p.uniform("u_count"), count);
      } else {
        gl.uniform1fv(p.uniform("u_w"), this.weights);
        gl.uniform1i(p.uniform("u_radius"), count);
      }
    }
  }
  /** Updates kernels when sigmas change (cells for bloom, cells for haze; haze runs at 1/4). */
  setSigmas(bloomSigma, hazeSigma) {
    if (bloomSigma !== this.bloomSigma) {
      this.bloomSigma = bloomSigma;
      this.uploadKernel(0, bloomSigma);
    }
    if (hazeSigma !== this.hazeSigma) {
      this.hazeSigma = hazeSigma;
      this.uploadKernel(2, hazeSigma / 4);
    }
  }
  /** Updates per-target size uniforms (call after (re)allocation or logical size change). */
  setSizes(w, h, allocW, allocH, qw, qh, allocQW, allocQH) {
    const gl = this.ctx.gl;
    const dp = this.downsample.use();
    gl.uniform4f(dp.uniform("u_cellTex"), w, h, 1 / allocW, 1 / allocH);
    for (let i = 0; i < 4; i++) {
      const p = this.blurs[i]?.use();
      if (!p) continue;
      if (i < 2) gl.uniform4f(p.uniform("u_tex"), w, h, 1 / allocW, 1 / allocH);
      else gl.uniform4f(p.uniform("u_tex"), qw, qh, 1 / allocQW, 1 / allocQH);
      if (i === 1) gl.uniform4f(p.uniform("u_hazeTex"), qw, qh, 1 / allocQW, 1 / allocQH);
    }
  }
  /**
   * `bloom` already holds the bloom source (written by the field pass). Leaves the combined glow
   * in `glow` (bloom only / haze only for those debug views); `bloom` is scratch afterwards.
   */
  run(w, h, qw, qh, bloom, bloomTmp, haze, hazeTmp, glow2, debugView) {
    const gl = this.ctx.gl;
    bindTexture(gl, UNIT_SRC, bloom.tex);
    this.downsample.use();
    gl.bindFramebuffer(gl.FRAMEBUFFER, haze.fb);
    discardTargets(this.ctx);
    gl.viewport(0, 0, qw, qh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blurs[2]?.use();
    bindTexture(gl, UNIT_SRC, haze.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, hazeTmp.fb);
    discardTargets(this.ctx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blurs[3]?.use();
    bindTexture(gl, UNIT_SRC, hazeTmp.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, haze.fb);
    discardTargets(this.ctx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.viewport(0, 0, w, h);
    this.blurs[0]?.use();
    bindTexture(gl, UNIT_SRC, bloom.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bloomTmp.fb);
    discardTargets(this.ctx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const p = this.blurs[1]?.use();
    if (p && this.mixView !== debugView) {
      this.mixView = debugView;
      const m = glowMix(debugView);
      gl.uniform3f(p.uniform("u_mix"), m[0], m[1], m[2]);
    }
    bindTexture(gl, UNIT_SRC, bloomTmp.tex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, glow2.fb);
    discardTargets(this.ctx);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    bindTexture(gl, UNIT_SRC, null);
  }
  dispose() {
    this.downsample.dispose();
    for (const b of this.blurs) b.dispose();
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/composite-background.ts
function compositeBackgroundGlsl(cubeMask, backgroundProfile = "") {
  return `
mediump vec3 spot(mediump vec2 bp, mediump vec2 pos, mediump vec3 color, mediump float radius,
                  mediump float strength) {
  mediump vec2 d = bp - pos;
  mediump float r = max(radius, 1e-3);
  return color * (strength * exp2(-2.885 * dot(d, d) / (r * r)));
}


${backgroundProfile}
mediump vec3 compositeBackground(vec2 px, float inHost, bool useProfile) {
  // Background in host-centered mode units; the vignette touches background and haze only (the
  // glow's haze share carries it already).
  mediump vec2 bp = (px - f_space.xy) * f_space.z;
  mediump vec2 nuv = (px - f_space.xy) / max(0.5 * f_host.zw, vec2(1.0));
  mediump float vigAmount = P_background_vignette;
  mediump float vig = 1.0 - vigAmount * smoothstep(0.5, 1.45, length(nuv));
  mediump vec3 bg = P_background_color;
${cubeMask ? `  if (u_brand.x > 0.5) {
    float brand=smoothstep(u_brand.y,u_brand.z,px.x/f_host.z)*u_brand.w;
    // The stage underlay stays dark; colored light comes from cells and their glow.
    mediump vec3 vkBg=vec3(0.0003,0.0015,0.0137);
    mediump vec3 maxBg=vec3(0.004,0.0,0.0103);
    bg=mix(vkBg,maxBg,brand);
  }` : `  bg += spot(bp, P_background_spotA_position, P_background_spotA_color, P_background_spotA_radius, P_background_spotA_strength)
      + spot(bp, P_background_spotB_position, P_background_spotB_color, P_background_spotB_radius, P_background_spotB_strength);`}

  return ${backgroundProfile ? "useProfile ? profileUnderlay(px-f_host.xy,f_host.zw,bg*(inHost*vig)) : bg*(inHost*vig)" : "bg*(inHost*vig)"};
}
`;
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/composite-glow.ts
var COMPOSITE_GLOW_GLSL = `
mediump vec3 sampleCompositeGlow(sampler2D source,vec2 gp,vec4 cellTex,bool cubic,bool enabled) {
  mediump vec3 glow=vec3(0.0);
  if(enabled) {
    if(cubic) glow=texBicubicDec(source,gp,cellTex.xy,cellTex.zw).rgb;
    else glow=texBilinearDec(source,gp,cellTex.xy,cellTex.zw).rgb;
    glow*=GLOW_SCALE;
    vec2 ge=min(gp,cellTex.xy-gp);
    glow*=smoothstep(0.0,2.0,min(ge.x,ge.y));
  }
  return glow;
}
`;

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/td-morph.ts
var TD_MORPH_GLSL = `
uniform sampler2D u_morphAtlas;
uniform vec4 u_morphInfo,u_morphRect;
uniform vec2 u_morphOffset;
float tdMorphAt(vec2 center){
 if(u_morphInfo.z<.5)return 0.;
 ivec2 globalCell=ivec2(floor(vec2(center.x-f_host.x,f_host.w-center.y+f_host.y)/max(u_morphInfo.w,.001)));
 globalCell=clamp(globalCell,ivec2(0),ivec2(u_morphInfo.xy)-1);
 ivec2 local=clamp(globalCell-ivec2(u_morphOffset),ivec2(0),ivec2(u_morphRect.zw)-1);
 return clamp(texelFetch(u_morphAtlas,ivec2(u_morphRect.xy)+local,0).g,0.,1.);
}
`;
function initTdMorph(ctx, p) {
  setSampler(ctx.gl, p, "u_morphAtlas", 12);
}
function uploadTdMorph(ctx, p, input) {
  const gl = ctx.gl, m = input?.externalMask;
  gl.uniform4fv(p.uniform("u_morphInfo"), m?.morph ? [...m.size, 1, m.pitch] : [1, 1, 0, 1]);
  gl.uniform4fv(p.uniform("u_morphRect"), m?.physicalRect ?? [0, 0, 1, 1]);
  gl.uniform2fv(p.uniform("u_morphOffset"), m?.offset ?? [0, 0]);
  bindTexture(gl, 12, m?.texture ?? null);
}

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/composite.ts
function compositeFs(header, cubeMask, cubeGeometry, cubeMinPitch, profile = "", backgroundProfile = "") {
  return `${header}
uniform sampler2D u_fieldA;
uniform sampler2D u_fieldB;
uniform sampler2D u_glow;
uniform sampler2D u_lut;
uniform sampler2D u_stampA;
uniform sampler2D u_stampB;
${TD_MORPH_GLSL}
${cubeMask ? "uniform sampler2D u_maskSource;" : ""}
uniform vec4 u_cellTex;  // xy logical cell texture size, zw 1 / allocation
uniform vec4 u_view;     // xy drawing buffer px, z quality (0 high, 1 medium, 2 low), w debug view
uniform vec4 u_output; // top-left origin and tile size in full-domain pixels
uniform float u_outputLinear; // host atlas receives linear RGB; canvas receives original sRGB
${cubeMask ? "uniform vec4 u_brand; // same global rear-wall transition as field pass" : ""}
${cubeMask ? `uniform vec4 u_fill; // mode, opacity, gap contribution, inverse contribution
uniform vec2 u_fillEdge;
uniform vec3 u_fillVk,u_fillMax;
uniform sampler2D u_lookupVk,u_lookupMax;` : ""}
uniform vec2 u_flags;    // x opaque output, y glow on (the glow passes ran this frame)
out vec4 o_color;
${COMPOSITE_GLOW_GLSL}

${compositeBackgroundGlsl(cubeMask, backgroundProfile)}
${cubeMask ? `float fillVisibleAt(vec2 p) {
  vec2 s=clamp(p-0.5,vec2(0.0),u_cellTex.xy-1.0);
  ivec2 a=ivec2(floor(s)),b=min(a+ivec2(1),ivec2(u_cellTex.xy)-1);
  vec2 f=fract(s);
  float x0=mix(texelFetch(u_fieldB,a,0).a,texelFetch(u_fieldB,ivec2(b.x,a.y),0).a,f.x);
  float x1=mix(texelFetch(u_fieldB,ivec2(a.x,b.y),0).a,texelFetch(u_fieldB,b,0).a,f.x);
  return sat(2.0*mix(x0,x1,f.y));
}` : ""}

${profile}
void main() {
  vec2 px = u_output.xy + vec2(gl_FragCoord.x, u_output.w - gl_FragCoord.y);
  float pitch = f_grid.z;
  vec2 gp = (px - f_origin.xy) / pitch;
  ivec2 lim = ivec2(u_cellTex.xy) - 1;
  ivec2 c = clamp(ivec2(floor(gp)), ivec2(0), lim);
  vec2 hp = px - f_host.xy;
  mediump float inHost = sat(min(hp.x, f_host.z - hp.x) + 0.5) * sat(min(hp.y, f_host.w - hp.y) + 0.5);
  int dbg = int(u_view.w + 0.5);
${cubeMask ? `  if (dbg == 5) {
    // Raw grayscale mask from the same FieldPass as the final image.
    float raw=dec4(texelFetch(u_maskSource,c,0)).a;
    o_color=vec4(vec3(raw*inHost),1.0);
    return;
  }` : ""}
  bool cubic = u_view.z < 0.5;
  bool lowQ = u_view.z > 1.5;

  mediump vec3 background = compositeBackground(px,inHost,dbg==0);

  // Combined bloom + haze (saturated and weighted per cell by the bloom pass). Decoded sampling:
  // hardware filtering on float targets, decode-then-filter on RGBA8.
  mediump vec3 glow = sampleCompositeGlow(u_glow,gp,u_cellTex,cubic,u_flags.y>0.5);

  mediump vec3 cellC = vec3(0.0);
  mediump vec3 halo = vec3(0.0);
  mediump vec4 f0 = vec4(0.0);
  mediump float cellCoverage = 0.0;
  if (inHost > 0.0 || dbg == 1) {
    f0 = dec4(texelFetch(u_fieldA, c, 0));
${cubeMask && cubeGeometry ? `    if (dbg == 1 || pitch < ${cubeMinPitch.toFixed(1)} || (texelFetch(u_fieldB,c,0).b < 0.001 && texelFetch(u_fieldB,c,0).a > 0.999)) {` : ""}
    mediump vec4 b0 = texelFetch(u_fieldB, c, 0);
    float morph=tdMorphAt(f_origin.xy+(vec2(c)+.5)*pitch);
    // The pixel's offset inside its cell: pitch and origin are whole pixels, so this indexes the
    // baked cell stamp exactly. Its quadrant picks the neighbours the halo stamp was baked for.
    int ip = int(pitch + 0.5);
    ivec2 m = clamp(ivec2(floor(px - f_origin.xy)) - c * ip, ivec2(0), ivec2(ip - 1));
    ivec2 q = ivec2(2 * m.x + 1 < ip ? -1 : 1, 2 * m.y + 1 < ip ? -1 : 1);
    mediump vec4 fx = vec4(0.0);
    mediump vec4 fy = vec4(0.0);
    mediump vec4 fd = vec4(0.0);
    mediump float lit = f0.a;
    if (!lowQ) {
      fx = dec4(texelFetch(u_fieldA, clamp(c + ivec2(q.x, 0), ivec2(0), lim), 0));
      fy = dec4(texelFetch(u_fieldA, clamp(c + ivec2(0, q.y), ivec2(0), lim), 0));
      fd = dec4(texelFetch(u_fieldA, clamp(c + q, ivec2(0), lim), 0));
      lit = max(max(f0.a, fx.a), max(fy.a, fd.a));
    }
    if (lit > 0.002 || b0.b > 0.002) {
      mediump vec4 sa = texelFetch(u_stampA, m, 0);
      if(morph>0.){
        vec2 local=px-f_origin.xy-(vec2(c)+.5)*pitch;
        float hb=(1.-P_grid_gap)*.5*pitch;
        float radius=mix(sat(P_grid_roundness),1.,morph)*hb;
        float distance=sdRoundBox(local,vec2(hb),radius);
        float aw=P_grid_softness+.5;
        float body=1.-smoothstep(-aw,aw,distance);
        float dc=length(local)/max(hb,.0001);
        sa.r=body*(1.-P_grid_emitter*min(dc*dc,1.));
        sa.g*=1.-morph;sa.b=mix(sa.b,.5,morph);
      }
      cellCoverage = sa.r;
      mediump float hk = b0.g * sa.g;
      mediump vec3 cc = f0.rgb;
      if (hk > 0.002) {
        float lutX = b0.r;
        mediump vec3 hotC = ${cubeMask ? "u_brand.x > 0.5 ? f0.rgb : texture(u_lut, vec2(lutX * (255.0 / 256.0) + 0.5 / 256.0, 0.75)).rgb" : "texture(u_lut, vec2(lutX * (255.0 / 256.0) + 0.5 / 256.0, 0.75)).rgb"};
        // Keep the tint near the base's brightness: whitening a dark navy cell must not paint a
        // grey dot. The mix runs in a gamma-2 space: linear mixing of a little near-white into
        // saturated neon already reads pastel after the sRGB encode.
        hotC *= min(1.0, 1.6 * max3M(f0.rgb) / max(max3M(hotC), 1e-4));
        cc = sq3M(mix(sqrt(f0.rgb), sqrt(hotC), hk));
      }
      cc = cc * (f0.a * (1.0 + 0.5 * hk)) + f0.rgb * b0.b;
      mediump float bevel = P_grid_bevel;
      if (bevel > 0.0 && !lowQ) cc *= max(0.0, 1.0 + 4.0 * bevel * (2.0 * sa.b - 1.0));
      cellC = cc * sa.r;
      if (!lowQ && lit > 0.002) {
        mediump vec4 sb = texelFetch(u_stampB, m, 0);
        mediump float haloStrength = P_glow_halo_strength;
        halo = (f0.rgb * (f0.a * sb.x) + fx.rgb * (fx.a * sb.y) + fy.rgb * (fy.a * sb.z)
             + fd.rgb * (fd.a * sb.w)) * haloStrength;
      }
    }
${cubeMask ? `    if (u_fill.x > 0.5 && cellCoverage <= 0.0)
      cellCoverage = texelFetch(u_stampA, m, 0).r;` : ""}
${cubeMask && cubeGeometry ? "    }" : ""}
  }

  mediump float gs = P_glow_saturation;
  halo = saturateColorM(halo, gs);

  mediump vec3 col;
  if (dbg == 0) col = background + glow + (cellC + halo) * inHost;
  else if (dbg == 1) col = f0.rgb * f0.a;
  else if (dbg == 2) col = halo * inHost;
  else if (dbg == 3 || dbg == 4) col = glow;  // the bloom pass isolated that layer
  else col = background + cellC * inHost;

${cubeMask ? `  if (dbg == 0 && u_fill.x > 0.5 && inHost > 0.0) {
    float visible=sat(2.0*texelFetch(u_fieldB,c,0).a);
    // The fourth preset uses one continuous signal for both alpha and LUT position.
    if (u_fill.x > 2.5) visible=fillVisibleAt(gp);
    float opacity=0.0;
    if (u_fill.x < 1.5 || u_fill.x > 2.5) {
      opacity=u_fill.y*(1.0-visible);
    } else {
      float spread=3.0;
      float broad=0.25*(fillVisibleAt(gp+vec2(-spread,-spread))+
        fillVisibleAt(gp+vec2(spread,-spread))+
        fillVisibleAt(gp+vec2(-spread,spread))+
        fillVisibleAt(gp+vec2(spread,spread)));
      float envelope=smoothstep(u_fillEdge.x,u_fillEdge.y,max(broad,0.35*visible));
      opacity=u_fill.y*envelope*(u_fill.z*(1.0-cellCoverage)+u_fill.w*(1.0-smoothstep(0.15,0.9,visible)));
    }
    float brand=u_brand.x>0.5 ? smoothstep(u_brand.y,u_brand.z,px.x/f_host.z)*u_brand.w : 0.0;
    vec3 fillColor=mix(u_fillVk,u_fillMax,brand);
    if (u_fill.x > 2.5) {
      vec3 vkColor=texture(u_lookupVk,vec2(visible,0.5)).rgb;
      vec3 maxColor=texture(u_lookupMax,vec2(visible,0.5)).rgb;
      vec3 rgb=mix(vkColor,maxColor,brand);
      fillColor=mix(rgb/12.92,pow((rgb+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),rgb));
    }
    col=mix(col,fillColor,sat(opacity)*inHost);
  }` : ""}

  mediump float exposure = P_glow_exposure;
  mediump float whitePoint = P_glow_whitePoint;
  mediump vec3 tm = tonemapMaxM(col * exposure, whitePoint);
  mediump vec3 srgb = sat3M(lin2srgbM(tm) + ditherTPDF(vec2(px.x, u_view.y-px.y)));
${profile ? `  srgb=profileComposite(px-f_host.xy,f_host.zw,lin2srgbM(tonemapMaxM((cellC+halo+glow)*exposure,whitePoint)));` : ""}
  mediump float a = 1.0;
#ifdef PROFILE_ALPHA
  a = profileAlpha(px-f_host.xy,f_host.zw);
#endif
  if (u_flags.x < 0.5 && inHost < 1.0) {
    // Glow-only margin: keep valid premultiplied alpha (rgb <= a) for every compositor.
    a = max(inHost, max3M(srgb));
    srgb = min(srgb, vec3(a));
  }
  mediump vec3 host = mix(srgb/12.92, pow((srgb+0.055)/1.055,vec3(2.4)), step(vec3(0.04045),srgb));
  o_color = vec4(u_outputLinear>0.5 ? host : srgb, a);
}
`;
}
var CompositePass = class {
  constructor(ctx, cubeMask = false, cubeGeometry = false, cubeMinPitch = 16, profile = "", backgroundProfile = "") {
    this.ctx = ctx;
    this.cubeMask = cubeMask;
    this.cubeGeometry = cubeGeometry;
    const gl = ctx.gl;
    this.prog = new LazyProgram(ctx, FULLSCREEN_VS, compositeFs(ctx.header, cubeMask, cubeGeometry, cubeMinPitch, profile, backgroundProfile), "composite", (p) => {
      setSampler(gl, p, "u_fieldA", UNIT_FIELD_A);
      setSampler(gl, p, "u_fieldB", UNIT_FIELD_B);
      setSampler(gl, p, "u_glow", UNIT_GLOW);
      setSampler(gl, p, "u_lut", UNIT_LUT);
      setSampler(gl, p, "u_stampA", UNIT_STAMP_A);
      setSampler(gl, p, "u_stampB", UNIT_STAMP_B);
      initTdMorph(ctx, p);
      if (cubeMask) setSampler(gl, p, "u_maskSource", UNIT_SRC);
      if (cubeMask) {
        setSampler(gl, p, "u_lookupVk", UNIT_LOOKUP_VK);
        setSampler(gl, p, "u_lookupMax", UNIT_LOOKUP_MAX);
      }
    });
  }
  ctx;
  cubeMask;
  cubeGeometry;
  prog;
  last = new Float32Array(12).fill(Number.NaN);
  poll() {
    return this.prog.poll();
  }
  /** Sizes are uploaded only when they change. `glow`: the glow target was rendered this frame. */
  run(viewW, viewH, w, h, allocW, allocH, quality, debugView, opaque, glow2, output = null) {
    const gl = this.ctx.gl;
    const p = this.prog.use();
    uploadTdMorph(this.ctx, p, output?.interaction);
    const l = this.last;
    if (l[0] !== w || l[1] !== h || l[2] !== allocW || l[3] !== allocH) {
      l[0] = w;
      l[1] = h;
      l[2] = allocW;
      l[3] = allocH;
      gl.uniform4f(p.uniform("u_cellTex"), w, h, 1 / allocW, 1 / allocH);
    }
    if (l[4] !== viewW || l[5] !== viewH || l[6] !== quality || l[7] !== debugView) {
      l[4] = viewW;
      l[5] = viewH;
      l[6] = quality;
      l[7] = debugView;
      gl.uniform4f(p.uniform("u_view"), viewW, viewH, quality, debugView);
    }
    const op = opaque ? 1 : 0;
    const gw = glow2 ? 1 : 0;
    if (l[8] !== op || l[9] !== gw) {
      l[8] = op;
      l[9] = gw;
      gl.uniform2f(p.uniform("u_flags"), op, gw);
    }
    gl.uniform4f(p.uniform("u_output"), output?.x ?? 0, output?.y ?? 0, output?.width ?? viewW, output?.height ?? viewH);
    gl.uniform1f(p.uniform("u_outputLinear"), output?.linear ? 1 : 0);
    if (this.cubeMask) gl.uniform4fv(p.uniform("u_brand"), output?.interaction?.brand ?? [0, 0, 1, 0]);
    if (this.cubeMask) {
      const fill = output?.interaction?.fill;
      gl.uniform4fv(p.uniform("u_fill"), fill?.controls ?? [0, 0, 0, 0]);
      gl.uniform2fv(p.uniform("u_fillEdge"), fill?.edge ?? [0, 1]);
      gl.uniform3fv(p.uniform("u_fillVk"), fill?.vk ?? [0, 0, 0]);
      gl.uniform3fv(p.uniform("u_fillMax"), fill?.max ?? [0, 0, 0]);
      bindTexture(gl, UNIT_LOOKUP_VK, fill?.lookupVk ?? null);
      bindTexture(gl, UNIT_LOOKUP_MAX, fill?.lookupMax ?? null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, output?.framebuffer ?? null);
    gl.viewport(0, 0, output?.width ?? viewW, output?.height ?? viewH);
    if (output?.blendProfile) {
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (output?.blendProfile) gl.disable(gl.BLEND);
  }
  dispose() {
    this.prog.dispose();
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/cubes.ts
function geometry() {
  const v = [0, 0, -1, 0, 0];
  const arcs = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const start = Math.atan2(sy, sx) - Math.PI / 4;
    for (let i = 0; i < 4; i++) {
      const a = start + i * Math.PI / 6;
      arcs.push([sx, sy, Math.cos(a), Math.sin(a)]);
    }
  }
  for (let ring = 0; ring < 3; ring++) for (const a of arcs) v.push(...a, ring);
  const ix = [];
  for (const r of [1, 0]) for (let i = 0; i < 16; i++) {
    const j = (i + 1) % 16, a = 1 + 16 * r + i, b = 1 + 16 * r + j;
    ix.push(a, a + 16, b, b, a + 16, b + 16);
  }
  for (let i = 0; i < 16; i++) ix.push(0, 1 + i, 1 + (i + 1) % 16);
  return { vertices: new Float32Array(v), indices: new Uint16Array(ix) };
}
function vs(header, cubeMask, sharedMotion) {
  return `${header}
layout(location=0) in vec2 a_sign;
layout(location=1) in vec2 a_arc;
layout(location=2) in float a_ring;
uniform sampler2D u_fieldA, u_fieldB;
${TD_MORPH_GLSL}
uniform ivec4 u_cells; // base xy, count x, logical texture width
uniform ivec2 u_limit;
uniform vec4 u_output; // output xywh in the shared canvas
${cubeMask ? "uniform vec4 u_cubeArt[21];" : ""}
out vec3 v_color;
out vec3 v_normal;
out float v_alpha;
out vec2 v_local;
out float v_morph;
void main() {
  int col = gl_InstanceID % u_cells.z;
  int row = gl_InstanceID / u_cells.z;
  ivec2 cell = u_cells.xy + ivec2(col, row);
  if (any(lessThan(cell, ivec2(0))) || any(greaterThanEqual(cell, u_limit))) {
    gl_Position = vec4(2.0,2.0,2.0,1.0); v_alpha=0.0; v_color=vec3(0.0); v_normal=vec3(0.0,0.0,1.0); return;
  }
  vec4 A = dec4(texelFetch(u_fieldA,cell,0));
  vec4 B = texelFetch(u_fieldB,cell,0);
  float energy = ${cubeMask ? "(B.b<0.001 && B.a>0.999)?0.0:clamp(B.r,0.0,1.0)" : "smoothstep(0.06,1.25,A.a)"};
  // Damped spring impulse around each passing Pulse band; its phase comes from the shared
  // clock and global cell position, so left/right crops never accumulate different state.
  vec2 center = f_origin.xy + (vec2(cell)+0.5)*f_grid.z;
  float morph=tdMorphAt(center);v_morph=morph;
  vec2 modePos = (center-f_space.xy)*f_space.z;
  float radial = length(modePos-P_modes_pulse_origin);
  float phase = ${cubeMask ? "length((center-f_host.xy)/max(f_host.zw,vec2(1.0))-vec2(0.5))/u_cubeArt[4].w-f_clock.x*u_cubeArt[4].z" : "radial*max(P_modes_pulse_frequency,0.01)-f_phaseA.w"};
  float age = 1.0-fract(phase+0.5);
  float spring = ${sharedMotion ? "0.0" : `exp(-${cubeMask ? "u_cubeArt[16].y" : "5.2"}*age)*sin(${cubeMask ? "u_cubeArt[16].z" : "14.0"}*age)`};
  float lift = max(0.0,energy*(${cubeMask ? "u_cubeArt[15].w+u_cubeArt[16].x" : "0.38+0.10"}*spring));
  float pitch = f_grid.z;
  float base = 1.0-P_grid_gap;
  // Preserve the full grayscale range in visible tile sizes. The previous
  // 1.34 gain hit the 1.14 cap well before white and fused bright regions.
  // Exact black stays zero; only the brightest tiles overlap a grid step.
  float size = pitch*${cubeMask ? "clamp(u_cubeArt[15].x*energy*B.b+u_cubeArt[15].y*max(spring,0.0)*energy,0.0,u_cubeArt[15].z)" : "max(0.02,base+energy*(1.045-base)+0.035*spring*energy)"};
  float radius = mix(clamp(P_grid_roundness,0.02,0.48)*0.5,.5,morph);
  vec2 p = a_ring<0.0 ? vec2(0.0) : a_sign*(0.5-radius)+a_arc*radius;
  // Circumscribe the analytic circle so its AA edge is inside the existing mesh.
  p*=mix(1.,1.05,morph);
  v_local=p;
  if (a_ring<0.5) p*=mix(.86,1.,morph); // flatten shoulder into the white disc
  float z = a_ring<0.5 ? 0.0 : a_ring<1.5 ? -0.055 : -0.38;
  z*=1.-morph;
  vec3 pos = vec3(p*size,z*size+lift*pitch);
  // Shallow oblique camera: actual Z changes projected position and exposes the rounded sides.
  pos = vec3(pos.x+0.16*pos.z,pos.y-0.24*pos.z,pos.z);
  float perspective = 1.0+0.12*pos.z/max(pitch,1.0);
  vec2 screen = center+pos.xy*perspective;
  vec2 ndc = vec2((screen.x-u_output.x)/u_output.z*2.0-1.0,
                  1.0-(screen.y-u_output.y)/u_output.w*2.0);
  gl_Position = vec4(ndc,0.0,1.0);
  vec3 n = a_ring<0.5 ? vec3(0.0,0.0,1.0) :
           a_ring<1.5 ? normalize(vec3(a_arc*0.55,0.83)) : normalize(vec3(a_arc,0.08));
  v_normal = normalize(vec3(n.x+0.16*n.z,n.y-0.24*n.z,n.z));
  v_color = ${cubeMask ? "A.rgb*(1.0+0.35*B.g)" : "A.rgb * (A.a*(1.0+0.5*B.g)+B.b)"};
  v_alpha = ${cubeMask ? "smoothstep(0.0,0.025,energy)" : "smoothstep(0.015,0.08,A.a+B.b)"};
}`;
}
function fs(header, cubeMask, backgroundProfile) {
  return `${header}
in vec3 v_color;
in vec3 v_normal;
in float v_alpha;
in vec2 v_local;
in float v_morph;
uniform float u_linear;
uniform sampler2D u_glow;
uniform vec4 u_output,u_cellTex;
${cubeMask ? "uniform vec4 u_brand;" : ""}
uniform vec2 u_glowFlags; // enabled, high-quality filter
out vec4 o_color;
${COMPOSITE_GLOW_GLSL}
${compositeBackgroundGlsl(cubeMask, backgroundProfile)}
void main() {
  if(v_alpha<0.002) discard;
  vec3 N=normalize(v_normal);
  vec3 L=normalize(vec3(-0.38,-0.56,0.73));
  float diffuse=max(dot(N,L),0.0);
  float edge=1.0-smoothstep(0.62,0.95,N.z);
  // /CUBES/pbr1 uses roughness 1, specular level 0 and metallic .942.
  // A broad, color-tinted response keeps the form matte; no white pin glint.
  float broad=pow(max(dot(reflect(-L,N),vec3(0.0,0.0,1.0)),0.0),3.0);
  float grain=fract(sin(dot(floor(v_local*180.0),vec2(127.1,311.7)))*43758.5453)-0.5;
  float body=1.0+0.018*grain+0.025*sin(v_local.x*19.0+v_local.y*9.0);
  vec3 lit=v_color*(0.64+0.34*diffuse)*(1.0-0.13*edge+0.025*broad)*body;
  vec2 px=u_output.xy+vec2(gl_FragCoord.x,u_output.w-gl_FragCoord.y);
  vec2 gp=(px-f_origin.xy)/f_grid.z;
  vec3 glow=sampleCompositeGlow(u_glow,gp,u_cellTex,u_glowFlags.y>0.5,u_glowFlags.x>0.5);
  vec2 hp=px-f_host.xy;
  float inHost=sat(min(hp.x,f_host.z-hp.x)+.5)*sat(min(hp.y,f_host.w-hp.y)+.5);
  vec3 background=compositeBackground(px,inHost,true);
  vec3 display=clamp(lin2srgb(tonemapMax((background+lit+glow)*P_glow_exposure,P_glow_whitePoint)),0.0,1.0);
  display=mix(display,vec3(1.),v_morph);
  float distance=length(v_local),aa=max(fwidth(distance),.0001);
  float coverage=mix(1.,1.-smoothstep(.5-aa,.5+aa,distance),v_morph);
  if(coverage<.001)discard;
  vec3 linear=mix(display/12.92,pow((display+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),display));
  o_color=vec4(u_linear>0.5?linear:display,coverage);
}`;
}
var CubesPass = class {
  constructor(ctx, cubeMask = false, sharedMotion = false, minPitch = 16, backgroundProfile = "") {
    this.ctx = ctx;
    this.minPitch = minPitch;
    this.cubeMask = cubeMask;
    const gl = ctx.gl;
    this.prog = new LazyProgram(ctx, vs(ctx.header, cubeMask, sharedMotion), fs(ctx.header, cubeMask, backgroundProfile), "cubes", (p) => {
      setSampler(gl, p, "u_fieldA", UNIT_FIELD_A);
      setSampler(gl, p, "u_fieldB", UNIT_FIELD_B);
      setSampler(gl, p, "u_glow", UNIT_GLOW);
      initTdMorph(ctx, p);
    });
    const vao = gl.createVertexArray(), vertex = gl.createBuffer(), index = gl.createBuffer();
    if (!vao || !vertex || !index) throw Error("[lumicells] cannot create cubes buffers");
    this.vao = vao;
    this.vertex = vertex;
    this.index = index;
    const mesh = geometry();
    this.count = mesh.indices.length;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);
    gl.bindVertexArray(null);
  }
  ctx;
  minPitch;
  prog;
  cubeMask;
  vao;
  vertex;
  index;
  count;
  poll() {
    return this.prog.poll();
  }
  run(f, w, h, output, allocW, allocH, glowOn) {
    const gl = this.ctx.gl, pitch = f.pitchPx;
    if (pitch < this.minPitch) return 0;
    const ox = output?.x ?? 0, oy = output?.y ?? 0, vw = output?.width ?? f.canvasWidth, vh = output?.height ?? f.canvasHeight;
    const gx = f.frame[OFF_ORIGIN] ?? 0, gy = f.frame[OFF_ORIGIN + 1] ?? 0;
    const x = Math.max(0, Math.floor((ox - gx) / pitch) - 1), y = Math.max(0, Math.floor((oy - gy) / pitch) - 1);
    const nx = Math.min(w - x, Math.ceil((ox + vw - gx) / pitch) - x + 1);
    const ny = Math.min(h - y, Math.ceil((oy + vh - gy) / pitch) - y + 1);
    if (nx <= 0 || ny <= 0) return 0;
    const p = this.prog.use();
    uploadTdMorph(this.ctx, p, output?.interaction);
    gl.uniform4i(p.uniform("u_cells"), x, y, nx, w);
    gl.uniform2i(p.uniform("u_limit"), w, h);
    gl.uniform4f(p.uniform("u_output"), ox, oy, vw, vh);
    gl.uniform1f(p.uniform("u_linear"), output?.linear ? 1 : 0);
    gl.uniform4f(p.uniform("u_cellTex"), w, h, 1 / allocW, 1 / allocH);
    gl.uniform2f(p.uniform("u_glowFlags"), glowOn ? 1 : 0, f.quality === "high" ? 1 : 0);
    if (this.cubeMask) {
      gl.uniform4fv(p.uniform("u_brand"), output?.interaction?.brand ?? [0, 0, 1, 0]);
      const art = output?.interaction?.cubeArt;
      if (!(art instanceof Float32Array) || art.length !== 21 * 4) throw Error("[lumicells] missing CUBES art parameters");
      gl.uniform4fv(p.uniform("u_cubeArt[0]"), art.subarray(0, 17 * 4));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, output?.framebuffer ?? null);
    gl.viewport(0, 0, vw, vh);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    if (output?.interaction?.externalMask?.morph) {
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.drawElementsInstanced(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0, nx * ny);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
    return nx * ny;
  }
  dispose() {
    const gl = this.ctx.gl;
    this.prog.dispose();
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vertex);
    gl.deleteBuffer(this.index);
  }
};

// artifacts/ribbon/discovery-cutout.js
var DISCOVERY_CORNER_RADIUS = 0.28;
var DISCOVERY_CUTOUT_GLSL = `
uniform int u_discoveryCount;
uniform vec4 u_discoveryRects[32];
uniform float u_discoveryAlpha[32];
uniform float u_discoveryFeather;
float discoveryCutout(vec2 px,vec2 size,float pitch){
 float result=0.;
 for(int i=0;i<32;i++){
  if(i>=u_discoveryCount)break;
  if(u_discoveryAlpha[i]<=0.)continue;
  vec4 rect=u_discoveryRects[i]*vec4(size,size);
  float radius=${DISCOVERY_CORNER_RADIUS}*rect.w;
  vec2 q=abs(px-rect.xy-.5*rect.zw)-.5*rect.zw+radius;
  float distance=length(max(q,0.))+min(max(q.x,q.y),0.)-radius;
  float coverage=1.-smoothstep(0.,max(u_discoveryFeather*pitch,.0001),distance);
  result=max(result,coverage*u_discoveryAlpha[i]);
 }
 return clamp(result,0.,1.);
}
`;

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/influence.ts
var INFLUENCE_GLSL = (
  /* glsl */
  `
// Coverage 0..1 of influence i for a cell centered at px: 1 inside, smooth falloff outside,
// widened by half a cell so small shapes still register on at least one cell.
float influenceK(int i, vec2 px, float pitch) {
  vec4 a = f_inf[i * 3];
  vec4 b = f_inf[i * 3 + 1];
  vec2 hs = max(a.zw, vec2(b.x));
  float r = min(b.x, min(hs.x, hs.y));
  float d = sdRoundBox(px - a.xy, hs, r);
  float fo = max(b.y, 0.5 * pitch);
  return 1.0 - smoothstep(-0.5 * pitch, fo, d);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/flow.ts
var FLOW_GLSL = (
  /* glsl */
  `
vec3 mode_flow(ModeIn m) {
  float a = P_modes_flow_direction;
  vec2 d = vec2(cos(a), sin(a));
  float sc = max(P_modes_flow_scale, 0.01);
  vec2 q = vec2(dot(m.p, d), dot(m.p, vec2(-d.y, d.x))) * sc;
  float ph = f_phaseA.x;
  float fw = sc * m.cs;
  // Octave 0 carries the structure: it fades only once the noise itself gets finer than a cell
  // (e.g. a large scale at low zoom), instead of turning into shimmering salt-and-pepper.
  float n = 0.5 * noiseBand(fw) * gnoise3(vec3(q.x - ph, q.y, ph * 0.25));
  vec2 q1 = NOISE_ROT * q * 2.0 + vec2(19.0, 7.0);
  n += 0.25 * bandLimit(2.0 * fw) * gnoise3(vec3(q1.x - ph * 1.5, q1.y, ph * 0.5));
  vec2 q2 = NOISE_ROT * q1 * 2.0 + vec2(-11.0, 23.0);
  n += 0.125 * bandLimit(4.0 * fw) * gnoise3(vec3(q2.x - ph * 2.25, q2.y, ph * 0.75));
  float v = 0.42 + 1.3 * n;
  // Widen the threshold edge to the cell footprint so contours do not crawl cell to cell.
  float soft = sqrt(sq(P_modes_flow_softness) + sq(0.35 * fw));
  float thr = P_modes_flow_threshold;
  float I = smoothstep(thr - 0.5 * soft, thr + 0.5 * soft, v);
  // The envelope is the lit mask itself: a faint flow layer must not keep the outskirts dense.
  return vec3(I * (0.65 + 0.5 * sat(v)), I, 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/life.ts
var LIFE_LEVEL_GLSL = (
  /* glsl */
  `
float lifeLevel(vec4 L, float frac) {
  float F = max(P_modes_life_fadeSteps, 1.0);
  bool alive = L.r > 0.5;
  float Fx = alive ? clamp(0.4 * F, 1.0, 2.0) : F;
  float t = sat((L.g * 255.0 + frac) / Fx);
  t = t * t * (3.0 - 2.0 * t);
  // Old cells cool down a little so long-lived still lifes do not dominate.
  float target = alive ? 1.0 - 0.25 * smoothstep(8.0, 60.0, L.b * 255.0) : 0.0;
  return mix(L.a, target, t);
}
`
);
var LIFE_GLSL = (
  /* glsl */
  `
${LIFE_LEVEL_GLSL}
vec3 mode_life(ModeIn m) {
  vec4 L = texelFetch(u_life, m.cell, 0);
  return vec3(lifeLevel(L, f_clock.y), 0.8, 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/pulse.ts
var PULSE_GLSL = (
  /* glsl */
  `
vec3 mode_pulse(ModeIn m) {
  float r = length(m.p - P_modes_pulse_origin);
  float f = max(P_modes_pulse_frequency, 0.01);
  float x = r * f - f_phaseA.w;
  float dd = (fract(x + 0.5) - 0.5) / f;
  float w = sqrt(sq(0.5 * P_modes_pulse_width) + sq(0.5 * m.cs));
  float band = exp(-dd * dd / (2.0 * w * w));
  float mean = min(1.0, w * 2.5066 * f);
  band = mix(mean, band, bandLimit(f * m.cs));
  float fall = 0.25 + 0.95 * exp(-r * P_modes_pulse_falloff);
  // Breathes once every 4 rings; 0.25 * 1024 keeps the phase wrap seamless.
  float br = 1.0 - P_modes_pulse_breathe * (0.5 - 0.5 * cos(f_phaseA.w * TAU * 0.25));
  return vec3(band * fall * br, fall * br, 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/rain.ts
var RAIN_GLSL = (
  /* glsl */
  `
vec3 mode_rain(ModeIn m) {
  float a = P_modes_rain_angle;
  vec2 across = vec2(cos(a), sin(a));
  vec2 down = vec2(-sin(a), cos(a));
  float cs = max(m.cs, 1e-4);
  float col = floor(dot(m.p, across) / cs + 0.5);
  float along = dot(m.p, down) / cs;
  uint hc = pcg(uint(int(col) + 65536) * 3u + 17u);
  float spd = 0.5 + 0.25 * floor(u01(hc) * 5.0);
  float tailCells = max(P_modes_rain_tail / cs, 1.0);
  // Segment length in mode units, snapped to travel / n (travel = distance per phase period).
  // n is in the hundreds at usual cell sizes; the snap changes a length by at most 1 / (2n).
  float travel = 1024.0 * spd;
  float n = max(1.0, floor(travel / (tailCells * cs * (1.4 + 1.6 * u01(pcg(hc + 1u)))) + 0.5));
  float segLen = travel / (n * cs);
  // phase * spd / (cs * segLen) == phase * n / 1024: a 1024 wrap shifts u by exactly n.
  float u = along / segLen - f_phaseB.z * (n * (1.0 / 1024.0)) + u01(pcg(hc + 2u));
  float k = floor(u);
  // Segment key periodic in k with period n; equal to k itself for |k| < n / 2.
  float k0 = floor(0.5 * n);
  float kw = k + k0;
  kw -= n * floor((kw + 0.5) / n);
  uint key = uint(int(kw - k0) + 65536);
  float x = (u - k) * segLen - (segLen - tailCells);
  float isOn = step(u01(hash3(uvec3(uint(int(col) + 65536), key, 0x7a1u))), P_modes_rain_density);
  float tail = sat(x / tailCells);
  // The head's leading edge spans 1.5 cells: a fast column then brightens a cell over a few
  // frames instead of switching it on in one.
  float head = 1.0 - smoothstep(segLen - 1.5, segLen, (u - k) * segLen);
  // The tail end ramps in over one cell (a hard step there would pop cells off as it passes).
  float I = isOn * head * sat(x) * (0.2 + 0.8 * pow(tail, 1.4) + 0.3 * smoothstep(0.85, 1.0, tail));
  return vec3(I, 0.3 + 0.7 * sat(P_modes_rain_density * 2.0), 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/ripple.ts
var RIPPLE_GLSL = (
  /* glsl */
  `
vec3 mode_ripple(ModeIn m) {
  float life = max(P_modes_ripple_life, 0.1);
  float slots = min(P_modes_ripple_rate * life, 16.0);
  if (slots <= 0.0) return vec3(0.0);
  vec2 ext = 0.5 * f_host.zw * f_space.z;
  float zoom = max(P_scene_zoom, 0.05);
  float w = sqrt(sq(0.5 * P_modes_ripple_width) + sq(0.5 * m.cs));
  float acc = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    if (fi >= slots) break;
    uint e;
    float age = epochAt(f_epochB.zw, fi / slots, e);
    uint hh = hash3(uvec3(uint(i), e, 0x51f1u));
    // The last slot is only partially occupied so the drop rate is continuous in rate * life.
    if (fi + 1.0 > slots && u01(hh) > slots - fi) continue;
    vec2 c = (vec2(u01(pcg(hh)), u01(pcg(hh + 1u))) * 2.0 - 1.0) * ext * 0.9;
    c = (c - P_scene_center) / zoom;
    float radius = P_modes_ripple_speed * age * life;
    float dist = length(m.p - c);
    float band = exp(-sq(dist - radius) / (2.0 * w * w));
    // The impact is a brief small splash; the drop reads through its ring, not a filled disc.
    float amp = pow(1.0 - age, 1.5) * smoothstep(0.0, 0.06, age) * (0.45 + 0.55 * smoothstep(0.0, 2.0 * w, radius));
    acc += band * amp;
  }
  float I = 1.0 - exp(-2.5 * acc);
  return vec3(I, 0.5 + 0.5 * I, 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/sphere.ts
var SPHERE_GLSL = (
  /* glsl */
  `
vec3 mode_sphere(ModeIn m) {
  float R0 = max(P_modes_sphere_radius, 0.02);
  // The shell may sit off-center around the hole (thicker on the side it is shifted to); the
  // hole itself always stays on the composition center.
  vec2 sp = m.p - P_modes_sphere_shift;
  float rr = length(sp);
  vec2 dir = rr > 1e-5 ? sp / rr : vec2(1.0, 0.0);
  // Irregular outline: noise on the unit circle (no atan seam), evolving with the clock.
  float wob = gnoise3(vec3(dir * 1.3 + vec2(3.1, 7.7), f_clock.x * 0.125));
  float br = 1.0 + P_modes_sphere_breathe * sin(f_phaseA.z);
  float scale = br * (1.0 + P_modes_sphere_wobble * wob * 1.6);
  float R = R0 * scale;
  float r = rr / R;
  float bl = 0.7 * m.cs;

  // The hole wobbles far less than the outline: it frames the title and must stay round.
  float holeR = P_modes_sphere_hole * br * (1.0 + P_modes_sphere_wobble * wob * 0.5);
  float hs = sqrt(sq(P_modes_sphere_holeSoftness) + sq(bl));
  // hole = 0 is a solid ball (no dark dot or rim left in the middle).
  bool solid = P_modes_sphere_hole < 1e-3;
  float holeMask = solid ? 1.0 : smoothstep(holeR - 0.25 * bl, holeR + hs, m.r);

  float rc = min(r, 1.0);
  vec3 n = vec3(dir * rc, sqrt(max(1.0 - rc * rc, 0.0)));
  float la = P_modes_sphere_lightAngle;
  vec3 L = normalize(vec3(cos(la), sin(la), 0.9));
  float ndl = dot(n, L);
  // Soft wrap light on the body; most of the light shows as a narrow highlight that pushes a few
  // cells over the hot threshold on the lit inner edge.
  float ls = P_modes_sphere_lightStrength;
  // Up to ls = 0.5 a gentle wrap (the hollow reference ring); above it the shadow side deepens
  // toward a real terminator, so a solid orb reads as a lit planet.
  float shadeK = 0.3 * ls + 2.4 * sq(max(ls - 0.5, 0.0));
  float key = 1.0 - shadeK * (0.5 - 0.5 * ndl);
  float spec = ls * 0.35 * pow(max(ndl, 0.0), 24.0);

  float shellIn = 0.74 + 0.18 * pow(rc, max(P_modes_sphere_rimPower, 0.05));
  float ro = max(r - 1.0, 0.0);
  float of = max(P_modes_sphere_outerFalloff, 0.02);
  float dens = exp(-sq(ro / of));
  float bri = r < 1.0 ? shellIn : 0.92 * exp(-ro / (2.0 * of));

  float fa = P_modes_sphere_fadeAngle;
  float fd = dot(sp, vec2(cos(fa), sin(fa))) / R;
  float fade = 1.0 - P_modes_sphere_fadeAmount * smoothstep(0.9, 1.35, fd);

  float surf = P_modes_sphere_surface;
  float ns = 0.5;
  float patchN = 0.0;
  if (surf > 0.001 || holeMask > 0.0) {
    float tl = P_modes_sphere_tilt;
    float th = f_phaseA.y;
    vec3 sn = n;
    sn = vec3(sn.x, sn.y * cos(tl) - sn.z * sin(tl), sn.y * sin(tl) + sn.z * cos(tl));
    sn = vec3(sn.x * cos(th) + sn.z * sin(th), sn.y, -sn.x * sin(th) + sn.z * cos(th));
    float ss = P_modes_sphere_surfaceScale;
    float fw = ss * m.cs / R;
    // Every noise fades to its mean once it gets finer than a cell (noiseBand), so large
    // surface scales or a small orb do not alias into crawling per-cell speckle.
    float nIn = 0.7 * noiseBand(fw) * gnoise3(sn * ss + 11.0)
              + 0.3 * bandLimit(2.1 * fw) * gnoise3(sn * ss * 2.1 + vec3(5.0, 1.0, 9.0));
    float nOut = noiseBand(ss * m.cs) * gnoise3(vec3(sp * ss + 3.0, f_clock.x * 0.125));
    ns = sat(0.5 + 1.1 * mix(nIn, nOut, smoothstep(0.9, 1.15, r)));
    patchN = noiseBand(3.4 * m.cs / R) * gnoise3(sn * 3.4 + vec3(29.0, 3.0, 17.0));
  }
  float tex = mix(1.0, 0.35 + 1.3 * ns, surf);
  // Density follows the texture outside the rim too: the outskirts thin out in patches.
  float env = holeMask * fade * dens * mix(1.0, tex, smoothstep(0.95, 1.3, r));
  // A lit inner rim just outside the hole: the brightest cells frame the hole with a crisp edge.
  float rimIn = solid ? 0.0 : exp(-sq((m.r - holeR - hs) / (0.6 * hs + bl)));
  // The fade thins the density out much more than it dims the survivors (sparse, still crisp).
  float I = holeMask * bri * key * mix(1.0, fade, 0.25) * (tex + spec * (0.5 + ns)) * (1.0 + 0.2 * rimIn);

  float band = 1.0 - smoothstep(holeR + hs, holeR + hs + 0.6 * R, m.r);
  float accent = holeMask * band * smoothstep(-0.2, 0.2, patchN);
  return vec3(I, env, accent);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/vortex.ts
var VORTEX_GLSL = (
  /* glsl */
  `
vec3 mode_vortex(ModeIn m) {
  float r = m.r;
  float a = atan(m.p.y, m.p.x);
  float arms = max(1.0, floor(P_modes_vortex_arms + 0.5));
  float twist = P_modes_vortex_twist;
  float s = arms * (a - f_phaseB.y + twist * r);
  float v = 0.5 + 0.5 * cos(s);
  // Local spatial frequency (cycles per mode unit) of the arms at this radius.
  float freq = arms * sqrt(1.0 / max(r * r, 1e-4) + twist * twist) / TAU;
  v = mix(0.5, v, bandLimit(freq * m.cs));
  v = pow(v, 1.0 + 5.0 * P_modes_vortex_sharpness);
  float fall = exp(-r * P_modes_vortex_falloff) * smoothstep(0.0, 0.12, r);
  return vec3(v * fall * 1.2, fall, 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/wave.ts
var WAVE_GLSL = (
  /* glsl */
  `
vec3 mode_wave(ModeIn m) {
  float a = P_modes_wave_angle;
  float f = max(P_modes_wave_frequency, 0.01);
  float ph = f_phaseB.x;
  float k = P_modes_wave_interference;
  vec2 d1 = vec2(cos(a), sin(a));
  float w1 = 0.5 + 0.5 * sin(TAU * (dot(m.p, d1) * f - ph));
  w1 = mix(0.5, w1, bandLimit(f * m.cs));
  float v = w1;
  if (k > 0.001) {
    // Low-frequency domain warp (a quarter of the wave frequency): bends the crests.
    vec2 q = m.p;
    float wf = 0.35 * f;
    q += (0.12 / f) * vec2(sin(TAU * (m.p.y * wf + ph * 0.125)), sin(TAU * (m.p.x * wf - ph * 0.125)));
    vec2 d2 = vec2(cos(a + 1.1), sin(a + 1.1));
    float s1 = sin(TAU * (dot(q, d1) * f - ph)) * bandLimit(f * m.cs);
    float s2 = sin(TAU * (dot(q, d2) * f * 0.8 - ph * 0.75)) * bandLimit(0.8 * f * m.cs);
    vec2 c = 0.55 * vec2(sin(TAU * ph * 0.125), cos(TAU * ph * 0.1875));
    float s3 = sin(TAU * (length(q - c) * f * 0.7 - ph * 0.5)) * bandLimit(0.7 * f * m.cs);
    // Classic plasma: a sine of the summed waves draws wandering iso-lines (ridges that bend,
    // split and merge). The fold raises the local frequency ~1.5x, so it is band-limited too.
    float sum = s1 + s2 + s3;
    float fold = bandLimit(1.5 * f * m.cs);
    float plasma = 0.5 + 0.5 * mix(sum / 3.0, sin(1.6 * sum - TAU * ph * 0.25), fold);
    v = mix(w1, plasma, k);
  }
  v = pow(sat(v), 1.0 + 3.0 * P_modes_wave_sharpness);
  return vec3(v, 0.35 + 0.65 * v, 0.0);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/modes/index.ts
var ENGINE_MODE_IDS = [
  "flow",
  "sphere",
  "pulse",
  "wave",
  "ripple",
  "vortex",
  "life",
  "rain"
];
var MODE_SOURCES = {
  flow: FLOW_GLSL,
  sphere: SPHERE_GLSL,
  pulse: PULSE_GLSL,
  wave: WAVE_GLSL,
  ripple: RIPPLE_GLSL,
  vortex: VORTEX_GLSL,
  life: LIFE_GLSL,
  rain: RAIN_GLSL
};
var MODE_STRUCT_GLSL = (
  /* glsl */
  `
struct ModeIn {
  vec2 p;
  float r;
  float cs;
  ivec2 cell;
  float h;
};
`
);
var MODES_GLSL = ENGINE_MODE_IDS.map((id) => MODE_SOURCES[id]).join("\n");
var MODES_EVAL_GLSL = ENGINE_MODE_IDS.map(
  (id) => `  if (P_modes_${id}_weight > 0.001) addMode(x, P_modes_${id}_weight, mode_${id}(m));`
).join("\n");

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/noise.ts
var NOISE_GLSL = (
  /* glsl */
  `
#define NOISE_WRAP 255
// Per-octave domain rotation (36.87 deg) hides lattice alignment between octaves.
const mat2 NOISE_ROT = mat2(0.8, 0.6, -0.6, 0.8);

float grad3(uint h, vec3 p) {
  uint k = h & 15u;
  float u = k < 8u ? p.x : p.y;
  float v = k < 4u ? p.y : ((k == 12u || k == 14u) ? p.x : p.z);
  return ((k & 1u) == 0u ? u : -u) + ((k & 2u) == 0u ? v : -v);
}

// Roughly [-1, 1], zero at lattice points.
float gnoise3(vec3 p) {
  vec3 fl = floor(p);
  vec3 f = p - fl;
  ivec3 a = ivec3(fl) & NOISE_WRAP;
  ivec3 b = (a + 1) & NOISE_WRAP;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = grad3(hash3(uvec3(a.x, a.y, a.z)), f);
  float n100 = grad3(hash3(uvec3(b.x, a.y, a.z)), f - vec3(1.0, 0.0, 0.0));
  float n010 = grad3(hash3(uvec3(a.x, b.y, a.z)), f - vec3(0.0, 1.0, 0.0));
  float n110 = grad3(hash3(uvec3(b.x, b.y, a.z)), f - vec3(1.0, 1.0, 0.0));
  float n001 = grad3(hash3(uvec3(a.x, a.y, b.z)), f - vec3(0.0, 0.0, 1.0));
  float n101 = grad3(hash3(uvec3(b.x, a.y, b.z)), f - vec3(1.0, 0.0, 1.0));
  float n011 = grad3(hash3(uvec3(a.x, b.y, b.z)), f - vec3(0.0, 1.0, 1.0));
  float n111 = grad3(hash3(uvec3(b.x, b.y, b.z)), f - vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z);
}

vec2 grad2v(uint h) {
  return vec2(float(h & 0xffffu), float(h >> 16u)) * (2.0 / 65535.0) - 1.0;
}

float gnoise2(vec2 p) {
  vec2 fl = floor(p);
  vec2 f = p - fl;
  ivec2 a = ivec2(fl) & NOISE_WRAP;
  ivec2 b = (a + 1) & NOISE_WRAP;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n00 = dot(grad2v(hash2(uvec2(a.x, a.y))), f);
  float n10 = dot(grad2v(hash2(uvec2(b.x, a.y))), f - vec2(1.0, 0.0));
  float n01 = dot(grad2v(hash2(uvec2(a.x, b.y))), f - vec2(0.0, 1.0));
  float n11 = dot(grad2v(hash2(uvec2(b.x, b.y))), f - vec2(1.0, 1.0));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

// Band limit for gradient noise sampled once per cell; fw = its footprint in lattice units per
// cell. The noise spectrum peaks near 0.5 cycles per lattice unit, so the octave fades to its
// mean (0) as that peak approaches the cell Nyquist limit (fw 0.5..0.9) instead of aliasing
// into per-cell speckle.
float noiseBand(float fw) { return bandLimit(0.5 * fw); }

// fbm with domain rotation per octave. z (time) doubles per octave, which keeps periodicity.
// fw = footprint of octave 0 (lattice units per cell): finer octaves fade out by noiseBand().
float fbm3(vec3 p, int octaves, float fw) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    sum += amp * noiseBand(fw) * gnoise3(p);
    norm += amp;
    p.xy = NOISE_ROT * p.xy * 2.0 + vec2(17.0, 31.0);
    p.z *= 2.0;
    amp *= 0.5;
    fw *= 2.0;
  }
  return sum / norm;
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/glsl/cubes-mask.ts
var CUBES_MASK_GLSL = (
  /* glsl */
  `
// 21 vec4 rows from cubes-art.json, packed by cubes-art.js. The same values
// feed the field and geometry passes across all output crops.
uniform vec4 u_cubeArt[21];
float cubesEase(float x) { x=clamp(x,0.0,1.0); return x*x*(3.0-2.0*x); }
float cubesRamp(float x) {
  x=fract(x);
  vec3 k=u_cubeArt[12].xyz;
  if(x<k.x) return 1.0-cubesEase(x/k.x);
  if(x<k.y) return 0.0;
  if(x<k.z) return cubesEase((x-k.y)/(k.z-k.y));
  return 1.0;
}
vec3 cubesPalette(float x) {
  x=fract(x);
  const vec3 red=vec3(0.961,0.0,0.0);
  const vec3 dark=vec3(0.048800007,0.122,0.11346001);
  const vec3 blue=vec3(0.2997,0.5098049,0.9);
  if(x<0.055837564) return mix(blue,red,cubesEase((x+1.0-0.92903405)/(1.0+0.055837564-0.92903405)));
  if(x<0.3680203) return mix(red,dark,cubesEase((x-0.055837564)/(0.3680203-0.055837564)));
  if(x<0.92903405) return mix(dark,blue,cubesEase((x-0.3680203)/(0.92903405-0.3680203)));
  return mix(blue,red,cubesEase((x-0.92903405)/(1.0+0.055837564-0.92903405)));
}
// Linear-light values of the local brand tokens. VK Video: vkv-color-blue,
// vkv-color-neon-blue. MAX: max.project.palette.20260927.
// Color is sampled from its own field; the grayscale geometry mask never
// addresses this lookup. Red VK Video accents stay in the foreground content.
vec3 cubesVkColor(float t) {
  return mix(vec3(0.0,0.0513,1.0),vec3(0.0,0.1845,1.0),cubesEase(t));
}
vec3 cubesMaxColor(float t) {
  vec3 blue=vec3(0.063,0.0103,1.0);   // #471AFF
  vec3 violet=vec3(0.156,0.0103,1.0); // #6E1AFF
  vec3 purple=vec3(0.301,0.0,1.0);    // #9500FF
  vec3 cyan=vec3(0.0,0.521,1.0);      // #00BFFF
  if(t<0.38) return mix(blue,violet,cubesEase(t/0.38));
  if(t<0.76) return mix(violet,purple,cubesEase((t-0.38)/0.38));
  return mix(purple,cyan,0.36*cubesEase((t-0.76)/0.24));
}
float cubesNoise(vec3 p) { return 0.5+0.5*gnoise3(p); }
vec2 cubesMaskPartsAt(vec2 uv,float seconds) {
  // Noise TOP uses aspect-corrected UVs. The first noise is monochrome, so its
  // RGB channels all address the same XYZ point of the second Noise TOP.
  float aspect=f_host.z/max(f_host.w,1.0);
  vec2 coord=(uv-0.5)*vec2(aspect,1.0);
  // XY advection keeps broad islands travelling even near a 3D-noise extremum,
  // where pure Z evolution can appear stationary for several seconds.
  vec2 moving=coord+seconds*u_cubeArt[4].xy;
  float phase=seconds*u_cubeArt[4].z;
  float n3=cubesNoise(vec3(moving/u_cubeArt[0].x+u_cubeArt[0].zw,seconds*u_cubeArt[0].y+u_cubeArt[14].x));
  float n5=cubesNoise(vec3(moving/u_cubeArt[1].x+u_cubeArt[1].zw,seconds*u_cubeArt[1].y+u_cubeArt[14].y));
  // Keep the broad circular ramp, but bend its sampling coordinates with a
  // slowly moving field. The ring has a white core and a continuous gray halo.
  vec2 warp=vec2(
    gnoise3(vec3(moving/u_cubeArt[5].x+u_cubeArt[6].xy,seconds*u_cubeArt[5].y)),
    gnoise3(vec3(moving/u_cubeArt[5].x+u_cubeArt[6].zw,seconds*u_cubeArt[5].y))
  )*u_cubeArt[5].z;
  // Distance is measured in screen-height units, like the other noise fields.
  // Using normalized-width UV here made one ring cover almost the entire rear
  // wall at once and turned its white phase into a single flat slab.
  vec2 ringCoord=coord+warp;
  float ring=cubesRamp(length(ringCoord)/u_cubeArt[4].w-phase);
  float n4=cubesNoise(vec3(moving/u_cubeArt[2].x+u_cubeArt[2].zw,seconds*u_cubeArt[2].y+u_cubeArt[14].z));
  float fine=cubesNoise(vec3(moving/u_cubeArt[3].x+u_cubeArt[3].zw,seconds*u_cubeArt[3].y+u_cubeArt[14].w));
  // Keep the moving ramp out of the noise-only signal. The field pass caps
  // this signal before adding a crest, so a static noise island cannot be white.
  float noiseSignal=u_cubeArt[7].x+u_cubeArt[7].y*(n3-0.5)+u_cubeArt[7].z*(n5-0.5)
                   +u_cubeArt[7].w*(fine-0.5)+u_cubeArt[8].x*(n4-0.5);
  return vec2(noiseSignal,ring);
}
`
);

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/field.ts
function fieldFs(header, cubeMask, scenarioParameters, cubeGeometry, profile = "") {
  return `${header}
${NOISE_GLSL}
${cubeMask ? CUBES_MASK_GLSL : ""}
uniform sampler2D u_life;
uniform sampler2D u_lut;
uniform sampler2D u_inputA,u_inputB,u_body;
uniform sampler2D u_tdMask;
uniform sampler2D u_rowStream;
uniform float u_rowStreamEnabled;
${DISCOVERY_CUTOUT_GLSL}
${TD_MORPH_GLSL}
uniform vec4 u_tdMaskInfo; // full global lattice width/height, fresh snapshot, reserved
uniform vec4 u_tdPhysicalRect,u_tdColorRect;
uniform vec2 u_tdOffset;
uniform vec4 u_inputCrop,u_bodyCrop;
uniform vec2 u_inputMap;
uniform float u_inputMix,u_bodyAlive,u_inputEnabled,u_inputLocal;
uniform vec4 u_maskPair; // parent pitch, fine flag, large zero, fine zero (raw M)
uniform vec4 u_brand; // enabled, start/end normalised, purple amount
uniform vec4 u_jointRing0; // enabled, rear-wall UV center, radius in wall-height units
uniform vec4 u_jointRing1; // band width, dark-core radius, pulse Hz, radius excursion
layout(location = 0) out vec4 o_fieldA;
layout(location = 1) out vec4 o_fieldB;
layout(location = 2) out vec4 o_bloom;
${INFLUENCE_GLSL}
${BLOOM_SOURCE_GLSL}
${MODE_STRUCT_GLSL}
${MODES_GLSL}

struct Mix { float scr; float over; float sum; float mx; float w; float env; float accent; };

// Gate residual floor/sparkles and their emission before independent row streams enter.
void applyDiscovery(float keep) {
  if(keep>=1.)return;
  vec4 field=dec4(o_fieldA);field.a*=keep;o_fieldA=enc4(field);
  ${cubeGeometry ? "" : "o_fieldB.b*=keep;"}
  o_fieldB.a*=keep;
  vec4 bloom=dec4(o_bloom);bloom.rgb*=keep;o_bloom=enc4(bloom);
}

void applyRowStream(ivec2 cell) {
  if(u_rowStreamEnabled<0.5)return;
  vec4 line=texelFetch(u_rowStream,cell,0);
  if(line.a<=0.001)return;
  vec4 field=dec4(o_fieldA);
  field.rgb=mix(field.rgb,line.rgb/max(line.a,0.001),line.a);
  field.a=max(field.a,line.a*1.4);
  o_fieldA=enc4(field);
${scenarioParameters ? "  o_fieldB.r=max(o_fieldB.r,line.a);" : ""}
${scenarioParameters && cubeGeometry ? "  o_fieldB.b=0.0; o_fieldB.a=1.0;" : ""}
  vec4 bloom=dec4(o_bloom);
  o_bloom=enc4(vec4(max(bloom.rgb,bloomSource(field.rgb*field.a)),bloom.a));
}

void addMode(inout Mix x, float w, vec3 v) {
  float wi = w * max(v.x, 0.0);
  x.scr *= 1.0 - min(wi, 1.0);
  x.over += max(wi - 1.0, 0.0);
  x.sum += wi;
  x.mx = max(x.mx, wi);
  x.w += w;
  x.env = 1.0 - (1.0 - x.env) * (1.0 - sat(w * v.y));
  x.accent = max(x.accent, w * v.z);
}

// Per-cell value noise in time: aperiodic, smooth, identical at any frame rate. It doubles as the
// per-cell brightness variety: calm on the dense structure, twice as wide where the envelope
// thins out (the reference's outer band mixes bright and dim cells side by side).
float flickerF(uvec2 key, float h, float env) {
  float amt = P_animation_flicker_amount * (1.0 - 0.8 * f_clock.w)
            * (1.0 + 1.2 * (1.0 - smoothstep(0.3, 0.9, env)));
  amt = min(amt, 0.9);
  if (amt <= 0.001) return 1.0;
  // Each cell runs at k / FLICKER_RATE_STEPS (0.6..1.4) of the base phase. The whole part is
  // multiplied in integers: an EPOCH_WRAP jump of the base phase moves every cell by k whole
  // multiples of the cell's index period (EPOCH_WRAP / FLICKER_RATE_STEPS), so the wrap is
  // seamless, and the fraction keeps full precision.
  float q = float(FLICKER_RATE_STEPS);
  float k = floor((0.6 + 0.8 * h) * q + 0.5);
  uint pk = uint(f_epochB.x) * uint(k);
  float tt = (float(pk % FLICKER_RATE_STEPS) + f_epochB.y * k) / q + h * 7.0;
  float e = floor(tt);
  float f = tt - e;
  uint mask = EPOCH_MASK / FLICKER_RATE_STEPS;
  uint ue = (pk / FLICKER_RATE_STEPS + uint(e)) & mask;
  uint ue1 = (ue + 1u) & mask;
  float a = u01(hash3(uvec3(key.x ^ 0x68bc21ebu, key.y, ue)));
  float b = u01(hash3(uvec3(key.x ^ 0x68bc21ebu, key.y, ue1)));
  return 1.0 - amt * (1.0 - mix(a, b, f * f * (3.0 - 2.0 * f)));
}

// Sparsity: where the envelope is low, cells drop out (re-rolled every period, crossfaded over
// 0.4 s) instead of all dimming, and survivors get brighter and more varied: sparse, crisp
// outskirts. "vary" is the survivor's brightness factor (1 where nothing is killed).
float presenceF(uvec2 key, float h, float env, out float killP, out float vary) {
  // Calibrated on the reference: ~5% / 30% / 75% of cells out where the envelope is ~0.7 /
  // 0.45 / 0.1 at the default amount.
  killP = min(1.0, 1.45 * P_animation_sparsity_amount) * pow(1.0 - smoothstep(0.08, 0.9, env), 1.5);
  // Where the envelope is ~0 (far outskirts of a wide host) the survivors thin out to nothing, so
  // the edges read as clean navy instead of a uniform sprinkle of boosted cells.
  killP = mix(killP, sat(2.0 * P_animation_sparsity_amount), 1.0 - smoothstep(0.01, 0.1, env));
  vary = 1.0;
  if (killP <= 0.001) return 1.0;
  float period = max(P_animation_sparsity_period, 0.1);
  uint ue;
  float fr = epochAt(f_epochA.xy, h, ue);
  float x = smoothstep(period - 0.4, period, fr * period);
  uint ka = hash3(uvec3(key.x ^ 0x02e5be93u, key.y, ue));
  uint kb = hash3(uvec3(key.x ^ 0x02e5be93u, key.y, (ue + 1u) & EPOCH_MASK));
  float a = smoothstep(killP - 0.04, killP + 0.04, u01(ka));
  float b = smoothstep(killP - 0.04, killP + 0.04, u01(kb));
  vary = mix(1.0, mix(0.45 + 1.1 * u01(pcg(ka)), 0.45 + 1.1 * u01(pcg(kb)), x), sat(1.6 * killP));
  return mix(a, b, x);
}

// Event sparkles only inside the lit structure: fast attack, smooth release, never pure white.
float sparkleF(uvec2 key, float h, float I) {
  float rate = P_animation_sparkle_rate;
  if (rate <= 0.0 || P_animation_sparkle_amount <= 0.0) return 0.0;
  float D = max(P_animation_sparkle_duration, 0.05);
  uint ue;
  float x = epochAt(f_epochA.zw, h, ue);
  float fire = step(u01(hash3(uvec3(key.x ^ 0x2c1b3c6du, key.y, ue))), rate * D);
  float env = x < 0.3 ? smoothstep(0.0, 0.3, x) : sq((1.0 - x) / 0.7);
  return fire * env * smoothstep(0.2, 0.45, I) * (1.0 - f_clock.w);
}

// Spatial ramp calibration: at scale 1 / offset 0 the default ring runs from red (left) through
// violet to azure (right), with the far right fading into the palette's navy end.
#define SPATIAL_T0 0.45
#define SPATIAL_K 1.2
float mapT(float mode, vec2 p, float I, float cs) {
  float sc = P_color_scale;
  if (mode < 0.5) {
    // bend > 0 curves the color boundaries into arcs around the center: the ends of a boundary
    // drift toward the palette end, so the start color stays a crescent on one side.
    vec2 d = vec2(cos(P_color_angle), sin(P_color_angle));
    float across = dot(p, vec2(-d.y, d.x));
    return SPATIAL_T0 + 0.5 * SPATIAL_K * sc * (dot(p, d) + P_color_bend * across * across);
  }
  if (mode < 1.5) return length(p) * sc * 0.75;
  if (mode < 2.5) {
    // Mirrored so a non-cyclic palette has no seam; t = 0 toward color.angle.
    float u = fract((atan(p.y, p.x) - P_color_angle) / TAU + 1.0);
    return 0.5 + (0.5 - abs(2.0 * u - 1.0)) * sc;
  }
  if (mode < 3.5) return 0.5 + (I - 0.5) * sc;
  float fq = P_color_warpScale * 0.8;
  return 0.5 + 0.9 * sc * fbm3(vec3(p * fq + 13.0, f_clock.x * 0.0625), 3, fq * cs);
}

${profile}
void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  float pitch = f_grid.z;
  vec2 cpx = f_origin.xy + (vec2(cell) + 0.5) * pitch;
${profile ? `
  vec4 sceneCell=profileField(cpx-f_host.xy,f_host.zw);
  o_fieldA=enc4(sceneCell);
  o_fieldB=vec4(0.0,0.0,0.0,sceneCell.a*0.5);
  o_bloom=enc4(vec4(bloomSource(sceneCell.rgb*sceneCell.a),1.0));
  return;
` : ""}
  float discoveryKeep=1.-discoveryCutout(cpx-f_host.xy,f_host.zw,pitch);
${cubeMask ? `
  {
  // One sampled cell equals one instanced tile, as in TD fit1/fit2 -> TOP to CHOP.
  // Global host coordinates keep the 3072/4096 rear crops phase-aligned.
  vec2 maskCell=vec2(cell);
  vec2 maskPx=cpx;
  if(u_maskPair.x>0.5){
    maskCell=floor((cpx-f_host.xy)/u_maskPair.x);
    maskPx=f_host.xy+(maskCell+0.5)*u_maskPair.x;
  }
  vec2 uv=(maskPx-f_host.xy)/max(f_host.zw,vec2(1.0));
  // The broad TD mask supplies the moving shape. A stable, independent value
  // per global cell breaks equal-sized/equal-colored runs without flicker.
  float detail=gnoise3(vec3((maskCell+0.5)*u_cubeArt[11].x+u_cubeArt[11].zw,f_clock.x*u_cubeArt[11].y));
  uint tileKey=hash2(uvec2(ivec2(maskCell)+ivec2(int(u_cubeArt[20].z))));
  float tileA=u01(tileKey),tileB=u01(pcg(tileKey^0x9e3779b9u));
  // Noise alone spans black through gray, never white. Only the intersection
  // of a strong noise region and the passing ramp can produce exact-one peaks.
  vec2 maskParts=cubesMaskPartsAt(uv,f_clock.x);
  float noiseSignal=maskParts.x+u_cubeArt[8].y*detail+u_cubeArt[8].z*(tileA-0.5);
  float noiseMask=u_cubeArt[8].w*cubesEase((noiseSignal-u_cubeArt[9].x)/(u_cubeArt[9].y-u_cubeArt[9].x));
  float rampCrest=cubesEase((maskParts.y-u_cubeArt[9].z)/(u_cubeArt[9].w-u_cubeArt[9].z));
  float noiseCrest=cubesEase((noiseMask-u_cubeArt[10].x)/(u_cubeArt[10].y-u_cubeArt[10].x));
  float mask=noiseMask+(1.0-noiseMask)*rampCrest*noiseCrest;
  // The junction is a radial grayscale ramp sampled once per cell. It begins
  // dark, rises continuously to white, then blends back into the existing mask.
  // No full-resolution circular cut or material-specific overlay is involved.
  if(u_jointRing0.x>0.5){
    vec2 delta=(uv-u_jointRing0.yz)*vec2(f_host.z/max(f_host.w,1.0),1.0);
    float distanceToJoint=length(delta);
    float radius=u_jointRing0.w+u_jointRing1.w*sin(6.28318530718*u_jointRing1.z*f_clock.x);
    float rising=cubesEase((distanceToJoint-u_jointRing1.y)/max(radius-u_jointRing1.y,0.001));
    float falling=1.0-cubesEase((distanceToJoint-radius)/max(2.0*u_jointRing1.x,0.001));
    mask=mix(mask,rising*falling,falling);
  }
  float rawMask=mask;
  ivec2 tdLocal=ivec2(0);
  if(u_tdMaskInfo.z>0.5){
    vec2 cellUV=clamp((cpx-f_host.xy)/max(f_host.zw,vec2(1.0)),vec2(0.0),vec2(0.999999));
    ivec2 globalTexel=ivec2(floor(vec2(cpx.x-f_host.x,f_host.w-cpx.y+f_host.y)/max(u_tdMaskInfo.w,0.001)));
    globalTexel=clamp(globalTexel,ivec2(0),ivec2(u_tdMaskInfo.xy)-ivec2(1));
    tdLocal=clamp(globalTexel-ivec2(u_tdOffset),ivec2(0),ivec2(u_tdPhysicalRect.zw)-ivec2(1));
    rawMask=texelFetch(u_tdMask,ivec2(u_tdPhysicalRect.xy)+tdLocal,0).r;
  }
  float sourceMask=rawMask;
  rawMask*=discoveryKeep;
  mask*=discoveryKeep;
  if(u_maskPair.x>0.5){
    // External grayscale is direct for EACH independently authored layer.
    // The procedural fallback retains the complementary fine branch.
    mask=u_tdMaskInfo.z>0.5
      ? cubesEase((rawMask-(u_maskPair.y>0.5?u_maskPair.w:u_maskPair.z))/max(1.0-(u_maskPair.y>0.5?u_maskPair.w:u_maskPair.z),0.0001))
      : u_maskPair.y>0.5
      ? 1.0-cubesEase(rawMask/max(u_maskPair.w,0.0001))
      : cubesEase((rawMask-u_maskPair.z)/max(1.0-u_maskPair.z,0.0001));
  }
  vec3 base=cubesPalette(sourceMask); // cutout changes presence, never the source palette
  // Size follows the continuous mask, not palette R. The old red-channel
  // coupling made red islands huge and blue neighbours almost disappear.
  float activity=mask;
  // Even the brightest noise-only tile stays below a grid step after the
  // per-cell size variation; overlap is reserved for ramp/noise peaks.
  float sizeVariation=clamp(u_cubeArt[13].x+u_cubeArt[10].z*detail+u_cubeArt[10].w*(tileB-0.5),u_cubeArt[13].y,u_cubeArt[13].z);
  // Color gets independent broad and medium fields. Neighbour variation only
  // changes luminance, so it cannot invent off-brand hues or couple size to RGB.
  if(u_brand.x>0.5) {
    vec2 colorCoord=(uv-0.5)*vec2(f_host.z/max(f_host.w,1.0),1.0);
    float colorSignal=clamp(u_cubeArt[19].x
      +u_cubeArt[19].y*gnoise3(vec3(colorCoord*u_cubeArt[17].x+u_cubeArt[17].zw,f_clock.x*u_cubeArt[17].y))
      +u_cubeArt[19].z*gnoise3(vec3(colorCoord*u_cubeArt[18].x+u_cubeArt[18].zw,f_clock.x*u_cubeArt[18].y))
      +u_cubeArt[19].w*(tileB-0.5),0.0,1.0);
    // One 7168-pixel domain: the 3072-pixel service boundary is only a crop.
    float brand=smoothstep(u_brand.y,u_brand.z,cpx.x/f_host.z)*u_brand.w;
    base=mix(cubesVkColor(colorSignal),cubesMaxColor(colorSignal),brand);
    base*=u_cubeArt[20].x+u_cubeArt[20].y*tileA;
  } else {
    base*=vec3(0.91+0.18*tileB,0.94+0.12*tileA,0.92+0.16*tileB);
  }
  if(u_tdMaskInfo.z>0.5){
    vec3 rgb=texelFetch(u_tdMask,ivec2(u_tdColorRect.xy)+tdLocal,0).rgb;
    // Authored RGB is sRGB data; decode once into the lighting field.
    base=mix(rgb/12.92,pow((rgb+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),rgb));
  }
  base=mix(base,vec3(1.),tdMorphAt(cpx));
  vec2 map=u_inputCrop.xy+vec2(cpx.x/f_host.z,1.0-cpx.y/f_host.w)*u_inputCrop.zw;
  vec2 inputUV=mix(map/max(u_inputMap,vec2(1.0)),(map-u_inputCrop.xy)/max(u_inputCrop.zw,vec2(1.0)),u_inputLocal);
  float local=mix(texture(u_inputA,inputUV).g,texture(u_inputB,inputUV).g,u_inputMix)*4.0*u_inputEnabled;
  vec2 bodyUV=(map-u_bodyCrop.xy)/max(u_bodyCrop.zw,vec2(1.0));
  float inside=step(0.0,bodyUV.x)*step(bodyUV.x,1.0)*step(0.0,bodyUV.y)*step(bodyUV.y,1.0);
  vec3 body=texture(u_body,bodyUV).rgb*u_bodyAlive*inside;
  float reactive=max(0.0,local+body.g*1.5+body.b*0.25);
${scenarioParameters ? `  // Stage 1: the existing noise/ramp mask above remains the geometry signal.
  // Stage 2: original LumiCells controls resolve per-cell radiance separately.
  // The same flicker/sparsity response now drives the CUBES geometry mask.
  uvec2 scenarioKey=uvec2(cell+ivec2(4096));
  float baseIntensity=pow(max(mask,0.0),max(P_animation_gamma,0.05));
  float I=baseIntensity*P_animation_brightness*P_animation_energy;
  float flicker=flickerF(scenarioKey,tileA,mask);
  I*=flicker;
  float killP,vary;
  float presence=presenceF(scenarioKey,tileB,mask,killP,vary);
  I*=presence*vary;
  float visibleMask=baseIntensity*flicker*presence*vary;
  float sparkle=sparkleF(scenarioKey,tileA,I);
  I+=P_animation_sparkle_amount*sparkle;
  I+=reactive*(1.0-0.5*sat(I));
  float hot=smoothstep(P_color_hot_threshold,1.0,I)*P_color_hot_amount;
  float dead=P_animation_floor*mask*presence;
  ${cubeGeometry ? `// Stage 3 / CUBES: geometry follows the same animated visibility as the vanilla stamp.
  // Keep the production CUBES albedo independent of light controls.
  o_fieldA=enc4(vec4(base*(1.0+0.55*reactive),I));
  o_fieldB=vec4(sat(visibleMask),sat(reactive),sizeVariation,sat(visibleMask*0.5));` : `// Stage 3 / vanilla: preserve the current stamp/composite channel semantics.
  o_fieldA=enc4(vec4(base,I));
  // Local comparison shares pre-Energy visibility with CUBES in alpha.
  o_fieldB=vec4(mask,sat(hot),sat(dead),sat(visibleMask*0.5));`}
  o_bloom=enc4(vec4(bloomSource(base*I),rawMask));` : `  // Physical silhouette/pointer energy illuminates the tile and its bloom
  // without replacing the continuous size mask.
  o_fieldA=enc4(vec4(base*(1.0+0.55*reactive),activity));
  o_fieldB=vec4(mask,sat(reactive),sizeVariation,sat(mask*0.5));
  o_bloom=enc4(vec4(bloomSource(base*(0.48*activity*activity+reactive)),rawMask));`}
  applyDiscovery(discoveryKeep);
  applyRowStream(cell);
  return;
  }
` : ""}
  // Hash key relative to the center cell (cols and rows are odd): neither a pad change nor
  // symmetric grid growth (cols/rows change in steps of 2 around a fixed center) re-rolls the
  // cells that stay in place.
  ivec2 ctr = ivec2(int(f_grid.w + 0.5)) + (ivec2(f_grid.xy + 0.5) - 1) / 2;
  uvec2 key = uvec2(cell - ctr + 4096);
  uint hk = hash2(key);
  float h = u01(hk);
  float h2 = u01(pcg(hk ^ 0x9e3779b9u));
  float zoom = max(P_scene_zoom, 0.05);
  vec2 p = ((cpx - f_space.xy) * f_space.z - P_scene_center) / zoom;
  float cs = f_space.w / zoom;
  int nInf = int(f_counts.x + 0.5);

  // Repel influences push the sampling position outward before any mode sees it.
  for (int i = 0; i < MAX_INFLUENCES; i++) {
    if (i >= nInf) break;
    vec4 b = f_inf[i * 3 + 1];
    if (b.w > 3.5) {
      vec2 dv = cpx - f_inf[i * 3].xy;
      float len = length(dv);
      if (len > 1e-3) p += (dv / len) * (influenceK(i, cpx, pitch) * b.z * 0.25 / zoom);
    }
  }

  ModeIn m = ModeIn(p, length(p), cs, cell, h);
  Mix x = Mix(1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
${MODES_EVAL_GLSL}
  float blend = P_animation_blend;
  float I = blend < 0.5 ? 1.0 - x.scr + x.over : (blend < 1.5 ? x.sum / max(1.0, x.w) : x.mx);
  float env = sat(x.env);

  I = pow(max(I, 0.0), max(P_animation_gamma, 0.05)) * P_animation_brightness * P_animation_energy;
  I *= flickerF(key, h, env);
  // Heat is judged before the sparsity boost: a lone bright survivor in the outskirts must stay
  // saturated, only the genuinely hottest cells of the structure get pastel cores.
  float Iheat = I;
  float killP;
  float vary;
  float pres = presenceF(key, h2, env, killP, vary);
  // Dropped cells linger as dim squares next to the structure (the reference's outer band mixes
  // dim and bright cells) and vanish completely far out.
  I *= vary * mix(0.25 * smoothstep(0.2, 0.7, env), 1.0 + 2.5 * killP, pres);
  // Soft gate on near-black cells: against navy even I = 0.05 reads as a dim grid, while the
  // look wants the outskirts either empty or holding a few crisp survivors.
  I *= smoothstep(0.015, 0.09, I);
  float spk = sparkleF(key, h, I);
  I += P_animation_sparkle_amount * spk;
  // Sparkles are brightness peaks with only a hint of the hot tint, never white flashes.
  float hotAdd = 0.3 * spk * min(P_animation_sparkle_amount * 2.5, 1.0);

  // Influences (device px): light adds and tints, shadow multiplies down, lift heats up.
  vec3 tint = vec3(0.0);
  float tintW = 0.0;
  float shade = 1.0;
  for (int i = 0; i < MAX_INFLUENCES; i++) {
    if (i >= nInf) break;
    vec4 b = f_inf[i * 3 + 1];
    if (b.w > 2.5) continue;
    float k = influenceK(i, cpx, pitch) * b.z;
    if (k <= 0.0) continue;
    if (b.w < 0.5) {
      // Light lifts dim cells more than bright ones and never bleaches them: a lit neighbourhood
      // stays saturated neon instead of turning pastel.
      I += k * (1.0 - 0.5 * sat(I));
      vec4 c = f_inf[i * 3 + 2];
      tint += c.rgb * (k * c.a);
      tintW += k * c.a;
    } else if (b.w < 1.5) {
      shade *= 1.0 - sat(k);
    } else {
      I += 0.3 * k;
      hotAdd += 0.6 * k;
    }
  }
  // Pulses: gaussian rings in device px, widened to the cell footprint.
  int nPulse = int(f_counts.y + 0.5);
  for (int i = 0; i < MAX_PULSES; i++) {
    if (i >= nPulse) break;
    vec4 a = f_pulse[i * 3];
    vec4 b = f_pulse[i * 3 + 1];
    float w = sqrt(sq(0.5 * a.w) + sq(0.7 * pitch));
    float band = b.x * exp(-sq(length(cpx - a.xy) - a.z) / (2.0 * w * w));
    I += band;
    hotAdd += 0.1 * band;
    tint += f_pulse[i * 3 + 2].rgb * (band * b.y);
    tintW += band * b.y;
  }
  vec2 map = u_inputCrop.xy + vec2(cpx.x/f_host.z,1.0-cpx.y/f_host.w)*u_inputCrop.zw;
  vec2 inputUV=mix(map/max(u_inputMap,vec2(1.0)),(map-u_inputCrop.xy)/max(u_inputCrop.zw,vec2(1.0)),u_inputLocal);
  float local=mix(texture(u_inputA,inputUV).g,texture(u_inputB,inputUV).g,u_inputMix)*4.0*u_inputEnabled;
  vec2 bodyUV=(map-u_bodyCrop.xy)/max(u_bodyCrop.zw,vec2(1.0));
  float inside=step(0.0,bodyUV.x)*step(bodyUV.x,1.0)*step(0.0,bodyUV.y)*step(bodyUV.y,1.0);
  vec3 body=texture(u_body,bodyUV).rgb*u_bodyAlive*inside;
  I+=local*(1.0-0.5*sat(I))+body.g*1.5+body.b*0.25;
  I=max(I,body.r*0.28);
  float Ipre = I * shade;

  // Lift sockets: the source cell dims while its copy floats above.
  float sock = 0.0;
  int nSock = int(f_counts.z + 0.5);
  for (int i = 0; i < MAX_LIFTS; i++) {
    if (i >= nSock) break;
    vec4 s = f_socket[i];
    if (ivec2(floor(s.xy + 0.5)) == cell) sock = max(sock, s.z);
  }
  // Same gate as the lift pass: a copy faded out over a dark cell leaves no dimmed socket behind.
#ifdef P_lift_threshold
  float gateHi = P_lift_threshold;
#else
  float gateHi = 0.2;
#endif
  I = Ipre * (1.0 - sat(sock) * smoothstep(0.5 * gateHi, gateHi, Ipre));

  float hot = (smoothstep(P_color_hot_threshold, 1.0, Iheat) * P_color_hot_amount + hotAdd) * shade;

  // Palette position: mapping (+ crossfade from the previous mapping), warp, jitter, drift.
  float t = mapT(P_color_mapping, p, Ipre, cs);
  if (f_misc.y < 0.999) t = mix(mapT(f_misc.x, p, Ipre, cs), t, sat(f_misc.y));
  float warpN = P_color_warp > 0.0
    ? fbm3(vec3(p * P_color_warpScale, f_clock.x * 0.0625), 2, P_color_warpScale * cs)
    : 0.0;
  t += P_color_offset + P_color_warp * warpN + P_color_jitter * (h2 - 0.5)
     + P_color_intensityShift * (Ipre - 0.5);
  // Drift: tri() folds the palette (period 2, the drift phase wraps at 2 as well). The switch is a
  // per-frame flag (rate or phase nonzero), never the phase value itself.
  t = f_misc.w > 0.5 ? tri(t + f_phaseB.w) : sat(t);

  if(u_brand.x>0.5) t=smoothstep(u_brand.y,u_brand.z,cpx.x/f_host.z)*u_brand.w;
  vec3 base = texture(u_lut, vec2(t * (255.0 / 256.0) + 0.5 / 256.0, 0.25)).rgb;
  // Hue cues from the reference: organic inner-edge patches take the accent color on the cool
  // half of the palette (cyan in the blue), hot cells lean red on the warm side. Both in OKLab.
  // Sharpened so patch cores take the accent fully (distinct teal cells, not a tinted azure).
  float acc = sat(1.6 * x.accent * P_color_accent_amount - 0.3) * smoothstep(0.42, 0.58, t);
  float rot = 0.35 * sat(hot) * (1.0 - smoothstep(0.2, 0.35, t));
  if (acc > 1e-3 || rot > 1e-3) {
    vec3 lab = lin2oklab(base);
    float cr = cos(rot);
    float sr = sin(rot);
    lab.yz = vec2(lab.y * cr - lab.z * sr, lab.y * sr + lab.z * cr);
    lab = mix(lab, lin2oklab(P_color_accent_color), acc);
    base = max(oklab2lin(lab), vec3(0.0));
  }
  base = saturateColor(base, P_color_saturation);
  if (tintW > 0.0) base = mix(base, tint / tintW, sat(tintW));

  float dead = P_animation_floor * (0.25 + 0.75 * env) * pres * mix(1.0, shade, 0.7);
  // Quadratic visibility: unlit cells read faintly next to the structure and vanish in the hole
  // and the far outskirts (clean navy there, as in the reference).
  dead *= min(dead * 4.0, 1.0);
  o_fieldA = enc4(vec4(base, I));
  o_fieldB = vec4(t, sat(hot), sat(dead), sat(Ipre * 0.5));
  o_bloom = enc4(vec4(bloomSource(base * I), 1.0));
  applyDiscovery(discoveryKeep);
  applyRowStream(cell);
}
`;
}
var FieldPass = class {
  constructor(ctx, cubeMask = false, scenarioParameters = false, cubeGeometry = false, profile = "") {
    this.ctx = ctx;
    this.cubeMask = cubeMask;
    this.prog = new LazyProgram(ctx, FULLSCREEN_VS, fieldFs(ctx.header, cubeMask, scenarioParameters, cubeGeometry, profile), "field", (p) => {
      setSampler(ctx.gl, p, "u_life", UNIT_LIFE);
      initTdMorph(ctx, p);
      setSampler(ctx.gl, p, "u_lut", UNIT_LUT);
      setSampler(ctx.gl, p, "u_inputA", 9);
      setSampler(ctx.gl, p, "u_inputB", 10);
      setSampler(ctx.gl, p, "u_body", 11);
      setSampler(ctx.gl, p, "u_tdMask", 12);
      setSampler(ctx.gl, p, "u_rowStream", 13);
    });
  }
  ctx;
  prog;
  cubeMask;
  poll() {
    return this.prog.poll();
  }
  /** `fb` has three attachments: fieldA, fieldB and the bloom source. */
  run(fb, w, h, life, input = null) {
    const gl = this.ctx.gl;
    const p = this.prog.use();
    uploadTdMorph(this.ctx, p, input);
    const q = input?.crop ?? [0, 0, 1, 1], b = input?.bodyCrop ?? [0, 0, 1, 1], brand = input?.brand ?? [0, 0, 1, 0];
    gl.uniform4fv(p.uniform("u_inputCrop"), q);
    gl.uniform4fv(p.uniform("u_bodyCrop"), b);
    gl.uniform2fv(p.uniform("u_inputMap"), input?.map ?? [1, 1]);
    gl.uniform1f(p.uniform("u_inputMix"), input?.mix ?? 0);
    gl.uniform1f(p.uniform("u_bodyAlive"), input?.enabled === false ? 0 : input?.bodyAlive ?? 0);
    gl.uniform1f(p.uniform("u_inputEnabled"), input && input.enabled !== false ? 1 : 0);
    gl.uniform4fv(p.uniform("u_maskPair"), input?.maskPair ?? [0, 0, 0, 0]);
    gl.uniform4fv(p.uniform("u_tdMaskInfo"), input?.externalMask ? [...input.externalMask.size, 1, input.externalMask.pitch] : [1, 1, 0, 1]);
    gl.uniform1f(p.uniform("u_rowStreamEnabled"), input?.rowStream?.texture ? 1 : 0);
    gl.uniform1i(p.uniform("u_discoveryCount"), input?.discovery?.count ?? 0);
    gl.uniform1f(p.uniform("u_discoveryFeather"), input?.discovery?.featherCells ?? 3);
    if (input?.discovery?.count) {
      gl.uniform4fv(p.uniform("u_discoveryRects[0]"), input.discovery.rects);
      gl.uniform1fv(p.uniform("u_discoveryAlpha[0]"), input.discovery.alpha);
    }
    gl.uniform4fv(p.uniform("u_tdPhysicalRect"), input?.externalMask?.physicalRect ?? [0, 0, 1, 1]);
    gl.uniform4fv(p.uniform("u_tdColorRect"), input?.externalMask?.colorRect ?? [0, 0, 1, 1]);
    gl.uniform2fv(p.uniform("u_tdOffset"), input?.externalMask?.offset ?? [0, 0]);
    gl.uniform4fv(p.uniform("u_brand"), brand);
    gl.uniform4fv(p.uniform("u_jointRing0"), input?.jointRing?.[0] ?? [0, 0, 0, 0]);
    gl.uniform4fv(p.uniform("u_jointRing1"), input?.jointRing?.[1] ?? [0, 0, 0, 0]);
    if (this.cubeMask) {
      if (!(input?.cubeArt instanceof Float32Array) || input.cubeArt.length !== 21 * 4) throw Error("[lumicells] missing CUBES art parameters");
      gl.uniform4fv(p.uniform("u_cubeArt[0]"), input.cubeArt);
    }
    gl.uniform1f(p.uniform("u_inputLocal"), input?.local ? 1 : 0);
    bindTexture(gl, 9, input?.a ?? life);
    bindTexture(gl, 10, input?.b ?? life);
    bindTexture(gl, 11, input?.body ?? life);
    bindTexture(gl, 12, input?.externalMask?.texture ?? life);
    bindTexture(gl, 13, input?.rowStream?.texture ?? life);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    discardTargets(this.ctx, 3);
    gl.viewport(0, 0, w, h);
    bindTexture(gl, UNIT_LIFE, life);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  dispose() {
    this.prog.dispose();
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/life.ts
var LIFE_MODE_STEP = 0;
var LIFE_MODE_RESET = 1;
var LIFE_MODE_REMAP = 2;
function lifeFs(header) {
  return `${header}
${INFLUENCE_GLSL}
${LIFE_LEVEL_GLSL}
uniform sampler2D u_prev;
uniform ivec4 u_size;   // xy current logical size, zw previous logical size (remap)
uniform int u_mode;
uniform uint u_seed;
uniform int u_rule;
uniform float u_birth;
uniform float u_density;
out vec4 o_state;

float aliveAt(ivec2 c) {
  return texelFetch(u_prev, (c + u_size.xy) % u_size.xy, 0).r;
}

vec4 seeded(uvec2 key) {
  float a = step(u01(hash3(uvec3(key, u_seed ^ 0x5bd1e995u))), u_density);
  return vec4(a, 0.0, 0.0, 0.0);
}

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  uvec2 key = uvec2(c + 4096);
  if (u_mode == 1) { o_state = seeded(key); return; }
  if (u_mode == 2) {
    ivec2 src = c + (u_size.zw - u_size.xy) / 2;
    bool inside = all(greaterThanEqual(src, ivec2(0))) && all(lessThan(src, u_size.zw));
    o_state = inside ? texelFetch(u_prev, src, 0) : seeded(key);
    return;
  }
  vec4 self = texelFetch(u_prev, c, 0);
  int n = 0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      if (dx == 0 && dy == 0) continue;
      n += aliveAt(c + ivec2(dx, dy)) > 0.5 ? 1 : 0;
    }
  }
  // Birth / survival masks: bit k set = rule applies with k live neighbours.
  int bm = 8;    int sm = 12;            // conway    B3/S23
  if (u_rule == 1) { bm = 72; sm = 12; } // highlife  B36/S23
  if (u_rule == 2) { bm = 456; sm = 472; } // daynight B3678/S34678
  if (u_rule == 3) { bm = 4; sm = 0; }   // seeds     B2/S
  bool alive = self.r > 0.5;
  bool next = alive ? ((sm >> n) & 1) == 1 : ((bm >> n) & 1) == 1;
  if (!next && u01(hash3(uvec3(key, u_seed))) < u_birth) next = true;
  if (!next) {
    float pitch = f_grid.z;
    vec2 px = f_origin.xy + (vec2(c) + 0.5) * pitch;
    int nInf = int(f_counts.x + 0.5);
    float seedP = 0.0;
    for (int i = 0; i < MAX_INFLUENCES; i++) {
      if (i >= nInf) break;
      vec4 b = f_inf[i * 3 + 1];
      if (abs(b.w - 3.0) < 0.5) seedP = max(seedP, influenceK(i, px, pitch) * sat(b.z) * 0.5);
    }
    if (seedP > 0.0 && u01(hash3(uvec3(key, u_seed ^ 0x27d4eb2du))) < seedP) next = true;
  }
  float g = next == alive ? min(self.g * 255.0 + 1.0, 255.0) : 0.0;
  float age = next ? min(self.b * 255.0 + 1.0, 255.0) : 0.0;
  // On a change, remember the level shown at the end of the previous step.
  float lvl = next == alive ? self.a : lifeLevel(self, 1.0);
  o_state = vec4(next ? 1.0 : 0.0, g / 255.0, age / 255.0, lvl);
}
`;
}
var LifePass = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.prog = new LazyProgram(ctx, FULLSCREEN_VS, lifeFs(ctx.header), "life", (p) => {
      setSampler(ctx.gl, p, "u_prev", UNIT_SRC);
    });
  }
  ctx;
  prog;
  stepCounter = 0;
  poll() {
    return this.prog.poll();
  }
  /** Renders the next state of `src` into `dst` (viewport must be set to w x h by the caller). */
  run(mode, src, dst, w, h, prevW, prevH, f) {
    const gl = this.ctx.gl;
    const p = this.prog.use();
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
    discardTargets(this.ctx);
    gl.viewport(0, 0, w, h);
    bindTexture(gl, UNIT_SRC, src);
    gl.uniform4i(p.uniform("u_size"), w, h, Math.max(1, prevW), Math.max(1, prevH));
    gl.uniform1i(p.uniform("u_mode"), mode);
    this.stepCounter = this.stepCounter + 1 >>> 0;
    gl.uniform1ui(
      p.uniform("u_seed"),
      (f.lifeSeed >>> 0 ^ Math.imul(this.stepCounter, 2654435761)) >>> 0
    );
    gl.uniform1i(p.uniform("u_rule"), f.lifeRule | 0);
    gl.uniform1f(p.uniform("u_birth"), f.lifeBirth);
    gl.uniform1f(p.uniform("u_density"), f.lifeSeedDensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  dispose() {
    this.prog.dispose();
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/lift.ts
function liftVs(header) {
  return `${header}
layout(location = 0) in vec4 a_i0;  // cellX, cellY, offX, offY
layout(location = 1) in vec4 a_i1;  // scaleX, scaleY, tiltX, tiltY
layout(location = 2) in vec4 a_i2;  // h, alpha, blur, seed
uniform sampler2D u_fieldA;
uniform sampler2D u_fieldB;
uniform sampler2D u_lut;
uniform vec4 u_cellTex;
uniform vec4 u_output;
uniform vec4 u_view;  // xy drawing buffer px, z opaque output (1) or alpha canvas (0)
out vec2 v_plane;
flat out vec4 v_body;  // rgb body color (tonemapped, sRGB), a unused
flat out vec4 v_halo;  // rgb halo color per unit of kernel (linear, exposure applied), a unused
flat out vec4 v_geo;   // xy body half extents px, z height, w edge feather px
flat out vec4 v_misc;  // xy shadow offset px, z alpha, w corner radius px

#ifdef P_lift_threshold
#define LIFT_GATE_HI P_lift_threshold
#else
#define LIFT_GATE_HI 0.2
#endif

void main() {
  ivec2 lim = ivec2(u_cellTex.xy) - 1;
  ivec2 cell = clamp(ivec2(floor(a_i0.xy + 0.5)), ivec2(0), lim);
  vec4 A = dec4(texelFetch(u_fieldA, cell, 0));
  vec4 B = texelFetch(u_fieldB, cell, 0);
  float Ipre = B.a * 2.0;
  float h = a_i2.x;
  // Fade the copy out when its source cell goes dark (it would float over nothing).
  float gate = smoothstep(0.5 * LIFT_GATE_HI, LIFT_GATE_HI, Ipre);
  float alpha = sat(a_i2.y) * gate;
  float pitch = f_grid.z;
  vec2 center = f_origin.xy + (vec2(cell) + 0.5) * pitch + a_i0.zw;
  vec2 halfB = (1.0 - P_grid_gap) * 0.5 * pitch * max(a_i1.xy, vec2(0.05));
  float corner = sat(P_grid_roundness) * min(halfB.x, halfB.y);
  float la = P_modes_sphere_lightAngle;
  vec2 shOff = -vec2(cos(la), sin(la)) * (max(h, 0.0) * 0.3 * pitch);
  // Crisp like a grid cell unless the controller gave this lift a depth-of-field blur (bokeh).
  float feather = P_grid_softness + 0.5 + max(a_i2.z, 0.0) + 0.02 * pitch * max(h, 0.0);
  // Nonzero output reaches past the body edge by at most: feather (the body's edge ramp), 0.9
  // pitch (the halo, zero while h <= 0.05) and the shadow offset + blur (zero while h <= 0). The
  // regions overlap, so the quad takes the largest margin (+2 px of slack), not their sum.
  float hp = max(h, 0.0);
  float haloM = (h > 0.05 && P_lift_halo != 0.0) ? 0.9 * pitch : 0.0;
  float shadowM = (hp > 0.0 && P_lift_shadow > 0.0) ? length(shOff) + (0.15 + 0.5 * hp) * pitch : 0.0;
  float ext = max(halfB.x, halfB.y) + max(max(haloM, shadowM), feather) + 2.0;
  vec2 c = (vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0) * ext;
  float tx = a_i1.z;
  float ty = a_i1.w;
  vec3 v = vec3(c.x, c.y * cos(tx), c.y * sin(tx));
  v = vec3(v.x * cos(ty) + v.z * sin(ty), v.y, -v.x * sin(ty) + v.z * cos(ty));
  float focal = 6.0 * max(halfB.x, halfB.y);
  float w = max((focal + v.z) / focal, 0.2);
  vec2 s = center + v.xy / w;
  vec2 ndc = vec2((s.x-u_output.x) / u_output.z * 2.0 - 1.0, 1.0 - (s.y-u_output.y) / u_output.w * 2.0);
  gl_Position = alpha > 0.002 ? vec4(ndc * w, 0.0, w) : vec4(2.0, 2.0, 2.0, 1.0);
  v_plane = c;
  vec3 hotC = textureLod(u_lut, vec2(B.r * (255.0 / 256.0) + 0.5 / 256.0, 0.75), 0.0).rgb;
  hotC /= max(max3(hotC), 1e-4);
  // Brighter than the grid around it even after the tonemap shoulder (neighbours also get their
  // halo and bloom on top), otherwise the copy reads as a dim tile with a glowing outline.
  float Il = max(Ipre, 0.7) * (1.0 + 2.0 * P_lift_brightness * max(h, 0.0));
  // The popped cell glows in its local hue at full chroma even when it comes from the dark end
  // of the palette (outskirts); scaling a navy up would read as grey. Whitening stays a hint:
  // the hot tint is near white, and a pastel lift reads as a washed-out sticker.
  vec3 hue = A.rgb / max(max3(A.rgb), 1e-4);
  vec3 base = saturateColor(hue, 1.15);
  // Whitening mixes in a gamma-2 space: a linear mix of 10% near-white into saturated blue
  // already reads pastel after the sRGB encode.
  float whiten = sat(P_lift_whiten * max(h, 0.0) + 0.1 * B.g);
  vec3 col = sq3(mix(sqrt(base), sqrt(hotC), whiten)) * Il;
  float ex = P_glow_exposure;
  v_body = vec4(lin2srgb(tonemapMax(col * ex, P_glow_whitePoint)), 0.0);
  v_halo = vec4(saturateColor(base, P_glow_saturation) * (Il * P_lift_halo * 0.8 * ex), 0.0);
  v_geo = vec4(halfB, h, feather);
  v_misc = vec4(shOff, alpha, corner);
}
`;
}
function liftFs(header) {
  return `${header}
uniform vec4 u_view;
in vec2 v_plane;
flat in vec4 v_body;
flat in vec4 v_halo;
flat in vec4 v_geo;
flat in vec4 v_misc;
out vec4 o_color;

void main() {
  // Plane positions and distances stay highp (tens of px, sub-pixel edges); colors are mediump.
  float pitch = f_grid.z;
  float h = max(v_geo.z, 0.0);
  float feather = v_geo.w;
  float d = sdRoundBox(v_plane, v_geo.xy, v_misc.w);
  mediump float body = 1.0 - smoothstep(-feather, feather, d);
  float ds = sdRoundBox(v_plane - v_misc.xy, v_geo.xy, v_misc.w);
  float sBlur = (0.15 + 0.5 * h) * pitch;
  mediump float shadow = P_lift_shadow;
  mediump float shadowA = satM(shadow) * satM(h) * (1.0 - smoothstep(-sBlur, sBlur, ds));
  // Soft lobe only (a tight rim would outline the tile instead of making it glow), grown in with
  // the height: at h ~ 0 the copy still sits on its own cell. Exactly 0 there and under the body.
  mediump vec3 haloS = vec3(0.0);
  if (h > 0.05 && body < 1.0) {
    float dh = max(d, 0.0) / pitch;
    mediump float r2 = max(P_glow_halo_radius, 0.01) * (1.0 + 1.5 * h);
    mediump float haloK = 0.45 * exp2(-dh * 1.4427 / r2) * sq(sat(1.0 - dh / 0.9))
                        * smoothstep(0.05, 0.6, h);
    mediump vec3 haloC = v_halo.rgb;
    mediump float wp = P_glow_whitePoint;
    haloS = lin2srgbM(tonemapMaxM(haloC * haloK, wp));
  }
  mediump float alpha = v_misc.z;
  mediump vec3 bodyS = v_body.rgb;
  mediump vec3 rgb = (bodyS * body + haloS * (1.0 - body)) * alpha;
  mediump float a = alpha * (body + shadowA * (1.0 - body));
  if (u_view.z < 0.5) {
    // Alpha canvas: outside the host the composite leaves glow-only pixels (alpha ~ max3(rgb)),
    // and the purely additive halo (rgb > a) would push them past valid premultiplied alpha.
    // Raise alpha there like the composite does; inside the host (opaque) keep it additive.
    vec2 px = vec2(gl_FragCoord.x, u_view.y - gl_FragCoord.y);
    vec2 hp = px - f_host.xy;
    mediump float inHost = sat(min(hp.x, f_host.z - hp.x) + 0.5) * sat(min(hp.y, f_host.w - hp.y) + 0.5);
    a = mix(max(a, max3M(rgb)), a, inHost);
  }
  o_color = vec4(rgb, a);
}
`;
}
var LiftPass = class {
  constructor(ctx) {
    this.ctx = ctx;
    const gl = ctx.gl;
    this.prog = new LazyProgram(ctx, liftVs(ctx.header), liftFs(ctx.header), "lift", (p) => {
      setSampler(gl, p, "u_fieldA", UNIT_FIELD_A);
      setSampler(gl, p, "u_fieldB", UNIT_FIELD_B);
      setSampler(gl, p, "u_lut", UNIT_LUT);
    });
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (!vao || !buffer) throw new Error("[lumicells] cannot create lift buffers");
    this.vao = vao;
    this.buffer = buffer;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_LIFTS * LIFT_STRIDE * 4, gl.DYNAMIC_DRAW);
    const stride = LIFT_STRIDE * 4;
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, stride, i * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  ctx;
  prog;
  vao;
  buffer;
  last = new Float32Array(7).fill(Number.NaN);
  poll() {
    return this.prog.poll();
  }
  run(lifts, count, viewW, viewH, w, h, allocW, allocH, opaque, output = null) {
    const n = Math.min(count, MAX_LIFTS, Math.floor(lifts.length / LIFT_STRIDE));
    if (n <= 0) return;
    const gl = this.ctx.gl;
    const p = this.prog.use();
    const l = this.last;
    if (l[0] !== w || l[1] !== h || l[2] !== allocW || l[3] !== allocH) {
      l[0] = w;
      l[1] = h;
      l[2] = allocW;
      l[3] = allocH;
      gl.uniform4f(p.uniform("u_cellTex"), w, h, 1 / allocW, 1 / allocH);
    }
    const op = opaque ? 1 : 0;
    if (l[4] !== viewW || l[5] !== viewH || l[6] !== op) {
      l[4] = viewW;
      l[5] = viewH;
      l[6] = op;
      gl.uniform4f(p.uniform("u_view"), viewW, viewH, op, 0);
    }
    gl.uniform4f(p.uniform("u_output"), output?.x ?? 0, output?.y ?? 0, output?.width ?? viewW, output?.height ?? viewH);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, lifts, 0, n * LIFT_STRIDE);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }
  dispose() {
    const gl = this.ctx.gl;
    this.prog.dispose();
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.buffer);
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/passes/stamp.ts
var STAMP_STEP = 16;
function stampFs(header) {
  return `${header}
layout(location = 0) out vec4 o_a;
layout(location = 1) out vec4 o_b;

// d: distance from a body edge in pitch units (>= 0). Tight rim lobe + soft lobe; the window is
// flat across the gap and reaches exactly 0 at half a pitch (what makes the 2x2 quadrant exact).
float haloKernel(float d, float invR2) {
  return (0.6 * exp2(-d * 28.8539) + 0.35 * exp2(-d * invR2)) * (1.0 - smoothstep(0.2, 0.5, d));
}

void main() {
  float pitch = f_grid.z;
  // Pixel center relative to the cell center, device px (y down, like the composite).
  vec2 lc = gl_FragCoord.xy - 0.5 * pitch;
  float hb = (1.0 - P_grid_gap) * 0.5 * pitch;
  float rad = sat(P_grid_roundness) * hb;
  float d0 = sdRoundBox(lc, vec2(hb), rad);
  float aw = P_grid_softness + 0.5;
  float body = 1.0 - smoothstep(-aw, aw, d0);
  float dc = length(lc) / hb;
  float emit = 1.0 - P_grid_emitter * min(dc * dc, 1.0);
  // Pastel only in the core of hot cells: a soft rounded square (L4 norm, no diagonal creases
  // unlike the box SDF) following the body; the rim and the halo stay saturated.
  vec2 q2 = lc / hb;
  q2 *= q2;
  float dq = sqrt(sqrt(dot(q2, q2)));
  float core = 1.0 - smoothstep(0.45 * P_color_hot_core, 1.45 * P_color_hot_core, dq);
  float rim = 1.0 - smoothstep(0.0, 0.3 * hb, -d0);
  float bevel = rim * clamp(-(lc.x + lc.y) / hb, -1.0, 1.0);
  // Halo from the 2x2 quadrant neighbourhood (the quadrant the pixel sits in).
  float invR2 = 1.4427 / max(P_glow_halo_radius, 0.01);
  float ip = 1.0 / pitch;
  vec2 o = vec2(lc.x < 0.0 ? -pitch : pitch, lc.y < 0.0 ? -pitch : pitch);
  float k0 = haloKernel(max(d0, 0.0) * ip, invR2);
  float kx = haloKernel(max(sdRoundBox(lc - vec2(o.x, 0.0), vec2(hb), rad), 0.0) * ip, invR2);
  float ky = haloKernel(max(sdRoundBox(lc - vec2(0.0, o.y), vec2(hb), rad), 0.0) * ip, invR2);
  float kd = haloKernel(max(sdRoundBox(lc - o, vec2(hb), rad), 0.0) * ip, invR2);
  o_a = vec4(emit * body, core, 0.5 + 0.5 * bevel, 1.0);
  o_b = vec4(k0, kx, ky, kd) * (1.0 - body);
}
`;
}
var StampPass = class {
  constructor(ctx) {
    this.ctx = ctx;
    this.prog = new LazyProgram(ctx, FULLSCREEN_VS, stampFs(ctx.header), "cell-stamp", () => {
    });
  }
  ctx;
  prog;
  texA = null;
  texB = null;
  fb = null;
  alloc = 0;
  /** Pitch the stamp was baked for (0 = nothing baked yet). */
  pitch = 0;
  /** Set when the params block changed: the next update() re-bakes. */
  dirty = true;
  poll() {
    return this.prog.poll();
  }
  /** Bakes the stamp for `pitch` (device px) when it changed or `dirty` is set. */
  update(pitch) {
    const p = Math.max(1, Math.round(pitch));
    const gl = this.ctx.gl;
    bindTexture(gl, UNIT_STAMP_A, this.texA);
    bindTexture(gl, UNIT_STAMP_B, this.texB);
    if (!this.dirty && p === this.pitch && this.fb) return;
    if (!this.fb || needsRealloc(this.alloc, p, STAMP_STEP))
      this.allocate(bucketSize(p, STAMP_STEP));
    this.prog.use();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    discardTargets(this.ctx, 2);
    gl.viewport(0, 0, p, p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.pitch = p;
    this.dirty = false;
  }
  allocate(size) {
    const gl = this.ctx.gl;
    this.free();
    const format = this.ctx.caps.hdrFormat;
    gl.activeTexture(gl.TEXTURE0 + UNIT_SRC);
    this.texA = createTexture(gl, size, size, { format });
    this.texB = createTexture(gl, size, size, { format });
    this.fb = createMrtFramebuffer(gl, [this.texA, this.texB]);
    bindTexture(gl, UNIT_SRC, null);
    bindTexture(gl, UNIT_STAMP_A, this.texA);
    bindTexture(gl, UNIT_STAMP_B, this.texB);
    this.alloc = size;
  }
  free() {
    const gl = this.ctx.gl;
    gl.deleteFramebuffer(this.fb);
    gl.deleteTexture(this.texA);
    gl.deleteTexture(this.texB);
    this.fb = null;
    this.texA = null;
    this.texB = null;
    this.alloc = 0;
  }
  dispose() {
    this.prog.dispose();
    this.free();
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/resources.ts
var CELL_STEP = 32;
var QUARTER_STEP = 8;
var CellTargets = class {
  constructor(gl, caps) {
    this.gl = gl;
    this.caps = caps;
  }
  gl;
  caps;
  /** Logical sizes (cells incl. pad; quarter-res haze). */
  w = 0;
  h = 0;
  qw = 0;
  qh = 0;
  /** Allocated sizes. */
  aw = 0;
  ah = 0;
  aqw = 0;
  aqh = 0;
  /** Logical size before the last change (for the life remap). */
  prevW = 0;
  prevH = 0;
  fieldA = null;
  fieldB = null;
  /** fieldA, fieldB and the bloom source (bloom.tex) as one MRT framebuffer. */
  fieldFb = null;
  bloom = null;
  bloomTmp = null;
  /** Combined bloom + haze, the composite's only glow input (caps.glowFormat). */
  glow = null;
  haze = null;
  hazeTmp = null;
  /** Life ping-pong; `life[lifeCur]` holds the current state. */
  life = [];
  lifeCur = 0;
  /** Previous current-life texture kept alive across a reallocation until remapped. */
  orphanLife = null;
  target(w, h, hdr, filter, format) {
    const gl = this.gl;
    const tex = createTexture(gl, w, h, {
      filter,
      format: format ?? (hdr ? this.caps.hdrFormat : this.caps.rgba8)
    });
    const fb = createMrtFramebuffer(gl, [tex]);
    return { tex, fb };
  }
  free(t) {
    if (!t) return;
    this.gl.deleteFramebuffer(t.fb);
    this.gl.deleteTexture(t.tex);
  }
  /**
   * Makes the targets fit `w x h` cells. Returns 0 when nothing changed, 1 when only the logical
   * size changed, 2 when textures were reallocated (life state then sits in `orphanLife`).
   */
  ensure(w, h) {
    if (w === this.w && h === this.h && this.fieldFb) return 0;
    const gl = this.gl;
    this.prevW = this.w;
    this.prevH = this.h;
    const qw = Math.ceil(w / 4);
    const qh = Math.ceil(h / 4);
    let result = 1;
    if (!this.fieldFb || needsRealloc(this.aw, w, CELL_STEP) || needsRealloc(this.ah, h, CELL_STEP)) {
      result = 2;
      const aw = bucketSize(w, CELL_STEP);
      const ah = bucketSize(h, CELL_STEP);
      this.free(this.orphanLife);
      this.orphanLife = this.life[this.lifeCur] ?? null;
      this.free(this.life[1 - this.lifeCur] ?? null);
      this.freeCellTargets();
      this.fieldA = createTexture(gl, aw, ah, { format: this.caps.hdrFormat });
      this.fieldB = createTexture(gl, aw, ah, { format: this.caps.rgba8 });
      this.bloom = this.target(aw, ah, true, gl.LINEAR);
      this.fieldFb = createMrtFramebuffer(gl, [this.fieldA, this.fieldB, this.bloom.tex]);
      this.bloomTmp = this.target(aw, ah, true, gl.LINEAR);
      this.glow = this.target(aw, ah, true, gl.LINEAR, this.caps.glowFormat);
      this.life = [this.target(aw, ah, false, gl.NEAREST), this.target(aw, ah, false, gl.NEAREST)];
      this.lifeCur = 0;
      this.aw = aw;
      this.ah = ah;
    }
    if (!this.haze || needsRealloc(this.aqw, qw, QUARTER_STEP) || needsRealloc(this.aqh, qh, QUARTER_STEP)) {
      const aqw = bucketSize(qw, QUARTER_STEP);
      const aqh = bucketSize(qh, QUARTER_STEP);
      this.free(this.haze);
      this.free(this.hazeTmp);
      this.haze = this.target(aqw, aqh, true, gl.LINEAR);
      this.hazeTmp = this.target(aqw, aqh, true, gl.LINEAR);
      this.aqw = aqw;
      this.aqh = aqh;
    }
    this.w = w;
    this.h = h;
    this.qw = qw;
    this.qh = qh;
    return result;
  }
  releaseOrphanLife() {
    this.free(this.orphanLife);
    this.orphanLife = null;
  }
  freeCellTargets() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.fieldFb);
    gl.deleteTexture(this.fieldA);
    gl.deleteTexture(this.fieldB);
    this.fieldFb = null;
    this.fieldA = null;
    this.fieldB = null;
    this.free(this.bloom);
    this.free(this.bloomTmp);
    this.free(this.glow);
    this.bloom = null;
    this.bloomTmp = null;
    this.glow = null;
  }
  dispose() {
    this.freeCellTargets();
    for (const t of this.life) this.free(t);
    this.life = [];
    this.releaseOrphanLife();
    this.free(this.haze);
    this.free(this.hazeTmp);
    this.haze = null;
    this.hazeTmp = null;
    this.w = this.h = this.aw = this.ah = 0;
  }
};

// artifacts/ribbon/vendor/lumicells/src/core/engine/engine.ts
var LUT_WIDTH = 256;
var LUT_ROWS = 2;
var LUT_BYTES = LUT_WIDTH * LUT_ROWS * 4;
var QUALITY_INDEX = { high: 0, medium: 1, low: 2 };
var Engine = class {
  canvas;
  caps;
  /** True when the context only exists without failIfMajorPerformanceCaveat or on a CPU rasterizer. */
  softwareFallback;
  cubeInstances = 0;
  gl;
  opts;
  passes = null;
  res = null;
  paramsUbo = null;
  frameUbo = null;
  lutTex = null;
  timer = null;
  paramsFloats;
  /** FrameBlock upload ranges ([start, end) float pairs), reused every frame. */
  ranges = new Int32Array(6);
  linked = false;
  failure = null;
  disposed = false;
  paramsUploaded = false;
  lutUploaded = false;
  /** Set once the context has been lost: every GL object of this engine is dead for good. */
  wasLost = false;
  onContextLost = () => {
    this.wasLost = true;
  };
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts;
    const attrs = {
      alpha: !opts.opaque,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: true
    };
    let gl = canvas.getContext("webgl2", attrs);
    let caveat = false;
    if (!gl) {
      gl = canvas.getContext("webgl2", { ...attrs, failIfMajorPerformanceCaveat: false });
      caveat = !!gl;
    }
    if (!gl) throw new EngineError("no-webgl2", "[lumicells] WebGL2 is not available");
    this.gl = gl;
    this.caps = probeCaps(gl, opts.forceRgba8 ?? false);
    this.softwareFallback = caveat || this.caps.software;
    const declared = /u_p\s*\[\s*(\d+)\s*\]/.exec(opts.paramsPrelude);
    const vec4s = Math.max(1, Math.floor(opts.paramsVec4Count) || 0, Number(declared?.[1] ?? 0));
    this.paramsFloats = vec4s * 4;
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    if (opts.warnMissingParams ?? true) {
      const missing = missingParamMacros(opts.paramsPrelude);
      if (missing.length > 0) {
        console.warn(
          `[lumicells] params prelude lacks ${missing.length} macro(s), using defaults: ${missing.join(", ")}`
        );
      }
    }
    if (gl.isContextLost()) return;
    try {
      this.createResources();
    } catch (err) {
      this.fail(err, "resource");
    }
  }
  createResources() {
    const gl = this.gl;
    const ctx = {
      gl,
      caps: this.caps,
      header: buildHeader(this.caps.hdr, this.opts.paramsPrelude)
    };
    this.passes = {
      life: new LifePass(ctx),
      field: new FieldPass(ctx, this.opts.cubeMask ?? false, this.opts.scenarioParameters ?? false, this.opts.cubeGeometry ?? false, this.opts.sceneProfile?.field),
      bloom: new BloomPass(ctx),
      composite: new CompositePass(ctx, this.opts.cubeMask ?? false, this.opts.cubeGeometry ?? false, this.opts.cubeMinPitch ?? 16, this.opts.sceneProfile?.composite, this.opts.backgroundProfile),
      cubes: this.opts.cubeGeometry ? new CubesPass(ctx, this.opts.cubeMask ?? false, this.opts.scenarioParameters ?? false, this.opts.cubeMinPitch ?? 16, this.opts.backgroundProfile) : null,
      lift: new LiftPass(ctx),
      stamp: new StampPass(ctx)
    };
    this.res = new CellTargets(gl, this.caps);
    this.paramsUbo = gl.createBuffer();
    this.frameUbo = gl.createBuffer();
    if (!this.paramsUbo || !this.frameUbo)
      throw new Error("[lumicells] cannot create uniform buffers");
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.paramsUbo);
    gl.bufferData(gl.UNIFORM_BUFFER, this.paramsFloats * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.frameUbo);
    gl.bufferData(gl.UNIFORM_BUFFER, FRAME_BYTES, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BIND_PARAMS, this.paramsUbo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BIND_FRAME, this.frameUbo);
    gl.activeTexture(gl.TEXTURE0 + UNIT_LUT);
    this.lutTex = createTexture(gl, LUT_WIDTH, LUT_ROWS, {
      filter: gl.LINEAR,
      format: { internalFormat: gl.SRGB8_ALPHA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }
    });
    if (this.caps.timerQuery) this.timer = new GpuTimer(gl, this.caps.timerQuery);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);
  }
  /** Programs linked and the context alive. */
  get ready() {
    return this.linked && !this.failure && !this.disposed && !this.isContextLost();
  }
  /** The error that stopped the engine (compile/link or resource creation), if any. */
  get error() {
    return this.failure;
  }
  /** Last measured GPU time for a frame (EXT_disjoint_timer_query_webgl2), or null. */
  get gpuTimeMs() {
    return this.timer?.ms ?? null;
  }
  /**
   * True once the context was lost, even after the browser restored it: this engine's objects
   * belong to the dead context, so recovery is dispose() + a new Engine on the same canvas.
   */
  isContextLost() {
    return this.wasLost || this.gl.isContextLost();
  }
  /** Simulates a context loss (WEBGL_lose_context), for testing the recovery path. */
  loseContextForTesting() {
    if (!this.gl.isContextLost()) this.caps.loseContext?.loseContext();
  }
  restoreContextForTesting() {
    if (this.gl.isContextLost()) this.caps.loseContext?.restoreContext();
  }
  fail(err, code) {
    if (this.failure) return;
    const error = err instanceof ShaderError ? new EngineError("compile", err.message, { cause: err }) : err instanceof EngineError ? err : new EngineError(code, err instanceof Error ? err.message : String(err), { cause: err });
    this.failure = error;
    console.error(error);
    if (error.cause instanceof ShaderError && error.cause.source) console.debug(error.cause.source);
    this.opts.onError?.(error);
  }
  pollLinked() {
    const p = this.passes;
    if (!p) return false;
    try {
      let ok = p.life.poll();
      ok = p.field.poll() && ok;
      ok = p.bloom.poll() && ok;
      ok = p.composite.poll() && ok;
      if (p.cubes) ok = p.cubes.poll() && ok;
      ok = p.lift.poll() && ok;
      ok = p.stamp.poll() && ok;
      if (ok) {
        this.linked = true;
        p.bloom.invalidate();
      }
      return ok;
    } catch (err) {
      this.fail(err, "compile");
      return false;
    }
  }
  /**
   * Draws one frame. Returns false when nothing was drawn (not linked yet, context lost,
   * disposed or failed); the caller should keep showing its poster in that case.
   */
  render(f, output = null) {
    if (this.disposed || this.failure || !this.passes || !this.res) return false;
    if (this.isContextLost()) return false;
    if (!this.linked && !this.pollLinked()) return false;
    try {
      this.draw(f, this.passes, this.res, output);
      return true;
    } catch (err) {
      if (this.isContextLost()) return false;
      this.fail(err, "resource");
      return false;
    }
  }
  /** Draw the raw grayscale CUBES mask from the field already computed by render(). */
  renderMask(f, output) {
    if (!this.ready || !this.opts.cubeMask || !this.passes || !this.res?.bloom) return false;
    const gl = this.gl, res = this.res;
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.colorMask(true, true, true, true);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BIND_PARAMS, this.paramsUbo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BIND_FRAME, this.frameUbo);
    bindTexture(gl, UNIT_FIELD_A, res.fieldA);
    bindTexture(gl, UNIT_FIELD_B, res.fieldB);
    bindTexture(gl, UNIT_SRC, res.bloom.tex);
    this.passes.composite.run(
      f.canvasWidth,
      f.canvasHeight,
      res.w,
      res.h,
      res.aw,
      res.ah,
      QUALITY_INDEX[f.quality] ?? 0,
      5,
      true,
      false,
      output
    );
    return true;
  }
  draw(f, p, res, output) {
    const gl = this.gl;
    const canvas = this.canvas;
    const cw = Math.max(1, Math.floor(f.canvasWidth));
    const ch = Math.max(1, Math.floor(f.canvasHeight));
    if (!output && canvas.width !== cw) canvas.width = cw;
    if (!output && canvas.height !== ch) canvas.height = ch;
    const vw = output ? cw : gl.drawingBufferWidth;
    const vh = output ? ch : gl.drawingBufferHeight;
    const W = Math.max(1, f.cols + 2 * f.pad);
    const H = Math.max(1, f.rows + 2 * f.pad);
    gl.activeTexture(gl.TEXTURE0 + UNIT_SRC);
    const change = res.ensure(W, H);
    if (change !== 0) {
      p.bloom.setSizes(W, H, res.aw, res.ah, res.qw, res.qh, res.aqw, res.aqh);
      bindTexture(gl, UNIT_FIELD_A, res.fieldA);
      bindTexture(gl, UNIT_FIELD_B, res.fieldB);
      bindTexture(gl, UNIT_GLOW, res.glow?.tex ?? null);
      bindTexture(gl, UNIT_HAZE, res.haze?.tex ?? null);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.DITHER);
    gl.colorMask(true, true, true, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (let unit = 0; unit < 14; unit++) gl.bindSampler(unit, null);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BIND_PARAMS, this.paramsUbo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, BIND_FRAME, this.frameUbo);
    bindTexture(gl, UNIT_LUT, this.lutTex);
    bindTexture(gl, UNIT_FIELD_A, res.fieldA);
    bindTexture(gl, UNIT_FIELD_B, res.fieldB);
    bindTexture(gl, UNIT_GLOW, res.glow?.tex ?? null);
    this.upload(f);
    this.timer?.begin();
    const life0 = res.life[0];
    const life1 = res.life[1];
    if (!life0 || !life1) throw new Error("[lumicells] life targets missing");
    if (change === 2) {
      if (res.orphanLife && res.prevW > 0) {
        p.life.run(LIFE_MODE_REMAP, res.orphanLife.tex, life0.fb, W, H, res.prevW, res.prevH, f);
      } else {
        p.life.run(LIFE_MODE_RESET, life1.tex, life0.fb, W, H, W, H, f);
      }
      res.lifeCur = 0;
      res.releaseOrphanLife();
    } else if (change === 1) {
      this.lifeRun(LIFE_MODE_REMAP, f, res);
    }
    if (f.lifeReset) this.lifeRun(LIFE_MODE_RESET, f, res);
    else {
      const steps = Math.min(Math.max(f.lifeSteps | 0, 0), 2);
      for (let i = 0; i < steps; i++) this.lifeRun(LIFE_MODE_STEP, f, res);
    }
    const lifeCur = res.life[res.lifeCur];
    const { fieldFb, bloom, bloomTmp, haze, hazeTmp, glow: glow2 } = res;
    if (!fieldFb || !lifeCur || !bloom || !bloomTmp || !haze || !hazeTmp || !glow2) {
      throw new Error("[lumicells] cell targets missing");
    }
    p.field.run(fieldFb, W, H, lifeCur.tex, output?.interaction);
    const dbg = f.debugView | 0;
    const glowOn = (dbg === 0 || dbg === 3 || dbg === 4) && (f.bloomStrength !== 0 || f.hazeStrength !== 0);
    if (glowOn) {
      p.bloom.setSigmas(f.bloomSigma, f.hazeSigma);
      p.bloom.run(W, H, res.qw, res.qh, bloom, bloomTmp, haze, hazeTmp, glow2, dbg);
    }
    p.stamp.update(f.frame[OFF_GRID + 2] ?? f.pitchPx);
    p.composite.run(
      vw,
      vh,
      W,
      H,
      res.aw,
      res.ah,
      QUALITY_INDEX[f.quality] ?? 0,
      dbg,
      f.opaque,
      glowOn,
      output
    );
    this.cubeInstances = p.cubes && dbg === 0 ? p.cubes.run(f, W, H, output, res.aw, res.ah, glowOn) : 0;
    if (f.liftCount > 0 && dbg === 0) {
      p.lift.run(f.lifts, f.liftCount, vw, vh, W, H, res.aw, res.ah, f.opaque, output);
    }
    this.timer?.end();
  }
  lifeRun(mode, f, res) {
    const src = res.life[res.lifeCur];
    const dst = res.life[1 - res.lifeCur];
    if (!src || !dst || !this.passes) return;
    this.passes.life.run(
      mode,
      src.tex,
      dst.fb,
      res.w,
      res.h,
      res.prevW || res.w,
      res.prevH || res.h,
      f
    );
    res.lifeCur = 1 - res.lifeCur;
  }
  upload(f) {
    const gl = this.gl;
    if ((f.paramsDirty || !this.paramsUploaded) && this.paramsUbo) {
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.paramsUbo);
      gl.bufferSubData(
        gl.UNIFORM_BUFFER,
        0,
        f.params,
        0,
        Math.min(f.params.length, this.paramsFloats)
      );
      this.paramsUploaded = true;
      if (this.passes) this.passes.stamp.dirty = true;
    }
    if (this.frameUbo) {
      const fr = f.frame;
      const r = this.ranges;
      const n = frameUploadRanges(fr, r);
      gl.bindBuffer(gl.UNIFORM_BUFFER, this.frameUbo);
      for (let i = 0; i < n; i++) {
        const start = r[i * 2];
        const end = Math.min(fr.length, r[i * 2 + 1]);
        if (end > start) gl.bufferSubData(gl.UNIFORM_BUFFER, start * 4, fr, start, end - start);
      }
    }
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    if ((f.lutDirty || !this.lutUploaded) && this.lutTex && f.lut.length >= LUT_BYTES) {
      gl.activeTexture(gl.TEXTURE0 + UNIT_LUT);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        LUT_WIDTH,
        LUT_ROWS,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        f.lut
      );
      this.lutUploaded = true;
    }
  }
  /**
   * Reads back the last field pass (tests and debugging only; stalls the GPU).
   * a: fieldA decoded (rgb color, intensity) as floats; b: fieldB bytes. Row 0 = texel row 0.
   */
  readFieldForTesting() {
    const gl = this.gl;
    const res = this.res;
    if (!res?.fieldFb || this.isContextLost()) return null;
    const { w, h } = res;
    const a = new Float32Array(w * h * 4);
    const b = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, res.fieldFb);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    if (this.caps.hdr) {
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, a);
    } else {
      const raw = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      for (let i = 0; i < raw.length; i++) {
        const v = (raw[i] ?? 0) / 255;
        a[i] = v * v * 4;
      }
    }
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    return { w, h, a, b };
  }
  /** Frees every GL object (skipped on a lost context, where they are already gone). */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    const gl = this.gl;
    if (this.isContextLost()) {
      this.passes = null;
      this.res = null;
      this.timer = null;
      return;
    }
    try {
      this.timer?.dispose();
      if (this.passes) {
        this.passes.life.dispose();
        this.passes.field.dispose();
        this.passes.bloom.dispose();
        this.passes.composite.dispose();
        this.passes.cubes?.dispose();
        this.passes.lift.dispose();
        this.passes.stamp.dispose();
      }
      this.res?.dispose();
      gl.deleteBuffer(this.paramsUbo);
      gl.deleteBuffer(this.frameUbo);
      gl.deleteTexture(this.lutTex);
    } catch (err) {
      console.warn("[lumicells] engine dispose failed", err);
    }
    this.passes = null;
    this.res = null;
    this.timer = null;
  }
};
export {
  Controller,
  Engine,
  PRESETS,
  normalizeConfig
};
