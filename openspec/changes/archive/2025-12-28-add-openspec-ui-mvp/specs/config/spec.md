# Configuration Specification

## Purpose
Defines how the OpenSpec UI binary is configured and launched.

## Requirements

### 1. CLI Arguments
- `--config <path>`: Path to JSON config file.
- **Defaults**: If no config provided, look for `openspec-ui.json` in CWD or error.
- **Port**: Default to 3000 if not specified.

### 2. Config File Format (`openspec-ui.json`)
```json
{
  "sources": [
    { "name": "brain-gate", "path": "/Users/tako/repos/brain-gate/openspec" },
    { "name": "megg", "path": "/Users/tako/repos/megg/openspec" }
  ],
  "port": 3000
}
```

### 3. Environment Variables
- `PORT`: Overrides config port.
- `OPENSPEC_UI_CONFIG`: Overrides config file path.

### 4. Behavior
- **Validation**: Warn on startup if a source path does not exist, but do not crash.
- **Restart Required**: Configuration changes (adding sources) require a server restart.
- **Hot Reload (Content)**: Changes *within* the source directories are picked up automatically via file watchers.
