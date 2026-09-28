# D2 Diagrams — Reference

Extended reference material for the D2 diagrams skill. See [SKILL.md](SKILL.md)
for the render-and-self-check workflow; this file is the syntax and pattern
library to read before writing anything beyond a trivial diagram.

## Manual installation (setup.sh handles this — use it first)

```bash
# mise
mise install d2 && mise use -g d2

# macOS
brew install d2

# Linux/macOS/Windows (curl)
curl -fsSL https://d2lang.com/install.sh | sh -s --

# Go toolchain
go install oss.terrastruct.com/d2@latest
```

## Raw `d2` CLI (the render script wraps most of this — use these directly only for ad hoc exploration)

```bash
# Watch and auto-regenerate
d2 --watch diagram.d2 diagram.svg
d2 --watch --browser diagram.d2

# List themes / layouts
d2 themes
d2 layout

# Force a layout engine
d2 -l elk diagram.d2 output.svg
d2 -l dagre diagram.d2 output.svg

# Hand-drawn style
d2 --sketch diagram.d2 output.svg
```

## Basic shapes and connections

```d2
# Shapes (auto-created)
server
database
client

# Connections
client -> server: request
server -> database: query
database -> server: result
server -> client: response

# Bidirectional / undirected
a <-> b
a -- b
```

## Shape types

```d2
rect: {shape: rectangle}
oval: {shape: oval}
cyl: {shape: cylinder}
queue: {shape: queue}
pkg: {shape: package}
step: {shape: step}
page: {shape: page}
doc: {shape: document}
cloud: {shape: cloud}
diamond: {shape: diamond}
hex: {shape: hexagon}
para: {shape: parallelogram}
circle: {shape: circle}
```

## Containers (nesting)

```d2
server: {
  app: Application
  db: Database
  app -> db
}

client -> server.app
```

## Labels, icons, tooltips, links

```d2
a: "My Label"
a -> b: "connection label"

server: {
  icon: https://icons.terrastruct.com/essentials/004-server.svg
}

node: {
  tooltip: Additional information shown on hover
}

github: {
  link: https://github.com
}
```

## Styling

```d2
styled: {
  style: {
    fill: "#ff6b6b"
    stroke: "#c92a2a"
    stroke-width: 2
    border-radius: 8
    shadow: true
    opacity: 0.9
    font-color: white
  }
}

a -> b: {
  style: {
    stroke: red
    stroke-width: 3
    stroke-dash: 5
    animated: true
  }
}
```

Prefer `classes:` (below) over inline `style:` on individual nodes — hard-coded
fills fight the theme and break dark-mode rendering.

## Glob patterns

```d2
*: {
  style.fill: lightblue
}

* -> *: {
  style.stroke: gray
}
```

## Classes (reusable styles)

```d2
classes: {
  error: {
    style: {
      fill: "#ffebee"
      stroke: "#c62828"
      font-color: "#c62828"
      border-radius: 8
    }
  }
  success: {
    style: {
      fill: "#e8f5e9"
      stroke: "#2e7d32"
      font-color: "#2e7d32"
      border-radius: 8
    }
  }
  decision: {
    shape: diamond
    style: {
      fill: "#fff3e0"
      stroke: "#e65100"
      font-color: "#e65100"
    }
  }
}

start: Start {class: success}
check: Valid? {class: decision}
fail: Error {class: error}

start -> check
check -> fail: No
```

## Variables

```d2
vars: {
  primary-color: "#4a90d9"
}

box: {
  style.fill: ${primary-color}
}
```

## In-file configuration

```d2
vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 4
    dark-theme-id: 200
    pad: 20
    sketch: true
  }
}

a -> b -> c
```

## Special shapes

```d2
# SQL table
users: {
  shape: sql_table
  id: int {constraint: primary_key}
  name: varchar
  email: varchar {constraint: unique}
}

# Class diagram
MyClass: {
  shape: class
  +publicField: string
  -privateField: int
  #protectedField: bool
  +publicMethod(): void
  -privateMethod(): string
}

# Code block
code: |go
  func main() {
    fmt.Println("Hello")
  }
|
```

## Layers and scenarios (multi-board sources)

```d2
a -> b -> c

layers: {
  layer1: {
    a: Different in layer 1
  }
  layer2: {
    b: Different in layer 2
  }
}
```

### Reserved board keywords cannot be node names

`layers`, `scenarios`, and **`steps`** are reserved D2 board keywords. Naming a
node any of these — even nested inside a container — fails to compile:

```d2
slow: {
  steps: |md ... |   # ERROR: a node literally named `steps`
}
```

```
err: steps must be declared at a board root scope
err: edge with board keyword alone doesn't make sense
```

The fix is to rename the node (`steps` → `pipeline`/`stages`, `layers` →
`tiers`, etc.). The error is misleading — it points at board-scope rules, not
at the name collision — so recognise the symptom: a compile failure on a node
whose name happens to be `steps`/`layers`/`scenarios`.

## Common diagram patterns

### System architecture

```d2
direction: right

client: Client {
  icon: https://icons.terrastruct.com/essentials/user.svg
}

lb: Load Balancer {
  icon: https://icons.terrastruct.com/aws/Networking%20&%20Content%20Delivery/Elastic%20Load%20Balancing.svg
}

services: Services {
  api: API Server
  auth: Auth Service
  api -> auth: validate
}

data: Data Layer {
  db: PostgreSQL {
    shape: cylinder
  }
  cache: Redis {
    shape: cylinder
  }
}

client -> lb -> services.api
services.api -> data.db
services.api -> data.cache
```

### Sequence-like flow

```d2
direction: right

user: User
frontend: Frontend
api: API
db: Database

user -> frontend: 1. Click button
frontend -> api: 2. POST /action
api -> db: 3. INSERT
db -> api: 4. OK
api -> frontend: 5. 200 OK
frontend -> user: 6. Show success
```

For true interaction-over-time diagrams with lifelines and activation bars,
use `shape: sequence_diagram` on a container instead of hand-rolled arrows —
it gets you proper lifelines, activation bars, and async/note support.

### Decision tree / flowchart

Uses classes for consistent styling, diamond shapes for decisions, and
colored edges for Yes/No paths.

```d2
classes: {
  decision: {
    shape: diamond
    style: {
      fill: "#fff3e0"
      stroke: "#e65100"
      font-color: "#e65100"
    }
  }
  action: {
    shape: rectangle
    style: {
      fill: "#e3f2fd"
      stroke: "#1565c0"
      font-color: "#1565c0"
      border-radius: 8
    }
  }
  terminal: {
    shape: oval
    style: {
      fill: "#e8f5e9"
      stroke: "#2e7d32"
      font-color: "#2e7d32"
    }
  }
  warn: {
    shape: hexagon
    style: {
      fill: "#ffebee"
      stroke: "#c62828"
      font-color: "#c62828"
    }
  }
}

start: Start {class: terminal}
staged: Staged changes? {class: decision}
lint: Run linter {class: action}
pass: Lint pass? {class: decision}
commit: Create commit {class: action}
done: Done {class: terminal}
fix: Fix issues {class: warn}

start -> staged
staged -> lint: Yes {style.stroke: green}
staged -> done: No {style.stroke: red}
lint -> pass
pass -> commit: Yes {style.stroke: green}
pass -> fix: No {style.stroke: red}
fix -> lint
commit -> done
```

### Database ERD

```d2
users: {
  shape: sql_table
  id: int {constraint: primary_key}
  name: varchar(100)
  email: varchar(255) {constraint: unique}
  created_at: timestamp
}

orders: {
  shape: sql_table
  id: int {constraint: primary_key}
  user_id: int {constraint: foreign_key}
  total: decimal
  status: varchar(20)
}

items: {
  shape: sql_table
  id: int {constraint: primary_key}
  order_id: int {constraint: foreign_key}
  product_id: int
  quantity: int
}

users.id <-> orders.user_id
orders.id <-> items.order_id
```

### Kubernetes deployment

```d2
cluster: Kubernetes Cluster {
  ns: Namespace {
    deploy: Deployment {
      pod1: Pod
      pod2: Pod
      pod3: Pod
    }
    svc: Service {
      shape: hexagon
    }
    svc -> deploy
  }

  ingress: Ingress {
    shape: cloud
  }
  ingress -> ns.svc
}
```

## Theme categories

| Range | Category |
|-------|----------|
| 0-99 | Light themes |
| 100-199 | Special themes |
| 200-299 | Dark themes |

Popular themes:
- `0` - Default (Neutral)
- `1` - Neutral Grey
- `3` - Flagship Terrastruct
- `4` - Cool Classics
- `8` - Colorblind Clear
- `100` - Earth Tones
- `101` - Everglade Green
- `200` - Dark Mauve

Run `d2 themes` for the full, current list — theme IDs have shifted between
d2 versions in the past.

## Dark-mode-aware SVG

`d2 -t 1 --dark-theme 200 diagram.d2 output.svg` bundles both a light and a
dark render into one SVG that switches with the reader's OS/browser
`prefers-color-scheme` — the right default for anything embedded in a GitHub
README or docs site.

## D2 vs Mermaid

| Feature | D2 | Mermaid |
|---------|----|---------|
| Layout engines | Multiple (dagre, elk, tala) | Single |
| Theming | 100+ themes | 4 themes |
| Watch mode | Built-in | Requires external tools |
| SQL tables | Native | Limited |
| Sketch mode | Yes | No |
| Icons | Any URL | Limited |
| Containers | Deep nesting | Subgraphs only |
| Markdown embedding | Growing | Excellent |
| GitHub rendering | No | Native |

**Choose D2 when**: rich styling, complex layouts, SQL schemas, architecture
diagrams that benefit from a self-checking render loop.
**Choose Mermaid when**: Markdown/GitHub-native rendering, simpler syntax,
wide tool support is the priority over visual polish.
