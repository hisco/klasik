# go-schema-gen

Go tool that generates JSON Schema from Go structs using runtime reflection.

## Overview

This tool uses Go's reflection API and the `invopop/jsonschema` library to generate JSON Schema Draft 2020-12 from registered Go types. It's used by Klasik to enable TypeScript code generation from Go structs.

## Automatic Installation

**You don't need to build this manually!** When you run `klasik generate-go` for the first time, it will automatically:

1. Check if Go is installed
2. Run `go mod tidy` to download dependencies
3. Build the binary to `../../dist/bin/go-schema-gen`

This only happens once - subsequent runs use the cached binary.

## Manual Build (Optional)

If you want to build manually:

```bash
# From this directory:
./build.sh

# Or step by step:
go mod tidy
go build -o ../../dist/bin/go-schema-gen .
```

## Usage

```bash
# Generate JSON Schema for a registered type:
go-schema-gen --type "helm.sh/helm/v3/pkg/chart.Metadata"

# With options:
go-schema-gen --type "helm.sh/helm/v3/pkg/chart.Chart" --allow-additional
```

## Adding New Types

To add new Go packages/structs:

1. **Edit `registry.go`:**
```go
import (
    chart "helm.sh/helm/v3/pkg/chart"
    mypackage "github.com/org/package"  // Add your import
)

var typeRegistry = map[string]interface{}{
    // Existing types
    "helm.sh/helm/v3/pkg/chart.Metadata": chart.Metadata{},

    // Add your types
    "github.com/org/package.MyStruct": mypackage.MyStruct{},
}
```

2. **Update dependencies:**
```bash
go mod tidy
```

3. **Rebuild:**
```bash
./build.sh
```

4. **Use in Klasik:**
```bash
klasik generate-go \
  --type "github.com/org/package.MyStruct" \
  --output ./src/types
```

## Dependencies

- **Go 1.21+**
- `github.com/invopop/jsonschema` v0.12.0 - JSON Schema generation
- `helm.sh/helm/v3` v3.14.0 - Example package (Helm chart types)

## How It Works

1. User specifies a type path (e.g., `"helm.sh/helm/v3/pkg/chart.Metadata"`)
2. Tool looks up the type in `typeRegistry`
3. Uses `invopop/jsonschema.Reflector` to generate JSON Schema
4. Outputs JSON to stdout

**Architecture:**
```
Go Struct → reflect.TypeOf() → jsonschema.Reflector → JSON Schema → stdout
```

## Struct Tag Support

The `invopop/jsonschema` library respects these struct tags:

| Tag | Effect | Example |
|-----|--------|---------|
| `json:"fieldName"` | Property name | `json:"metadata"` |
| `json:",omitempty"` | Optional field | `json:"description,omitempty"` |
| `jsonschema:"required"` | Force required | `jsonschema:"required"` |
| `jsonschema:"minLength=5"` | Min length | `jsonschema:"minLength=5"` |
| `jsonschema:"pattern=^[A-Z]"` | Regex pattern | `jsonschema:"pattern=^[A-Z]"` |
| `jsonschema_description:"..."` | Field description | `jsonschema_description:"Chart name"` |

**Example:**
```go
type Chart struct {
    Name    string `json:"name" jsonschema:"required,minLength=1"`
    Version string `json:"version" jsonschema:"pattern=^v[0-9]"`
    Values  map[string]interface{} `json:"values,omitempty"`
}
```

## Troubleshooting

**"Type not registered" error:**
- Add the type to `registry.go` (see "Adding New Types" above)
- Make sure to import the package
- Run `go mod tidy`
- Rebuild with `./build.sh`

**Build errors:**
- Ensure Go 1.21+ is installed: `go version`
- Clear module cache: `go clean -modcache`
- Try: `rm -f go.sum && go mod tidy`

**Import errors:**
- Check that the package version matches `go.mod`
- Run `go get <package>@<version>` to update

## Limitations

- **No dynamic loading**: Types must be registered at compile time
- **Requires recompilation**: Adding new packages needs rebuild
- **Go installation required**: Cannot run without Go toolchain

## Future Enhancements

- Go plugin support for dynamic type loading
- Auto-discovery of types in packages
- Support for `validate` struct tags
- Pre-built binaries for multiple platforms
