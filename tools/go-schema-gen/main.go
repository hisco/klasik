package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/invopop/jsonschema"
)

// Config holds the CLI configuration
type Config struct {
	TypePath        string
	AllowAdditional bool
	Expanded        bool
}

func main() {
	config := parseFlags()

	// Get type value from registry
	typeValue, err := getType(config.TypePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// Extract package path from type path
	packagePath := extractPackagePath(config.TypePath)

	// Extract comments from Go source (AST parsing)
	comments, err := ExtractComments(packagePath)
	if err != nil {
		// Non-fatal: just warn and continue without comments
		fmt.Fprintf(os.Stderr, "Warning: Could not extract comments: %v\n", err)
		comments = make(CommentMap)
	}

	// Generate schema
	schema, err := generateSchema(typeValue, config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating schema: %v\n", err)
		os.Exit(1)
	}

	// Enrich schema with comments
	enrichSchemaWithComments(schema, comments, config.TypePath)

	// Output JSON
	output, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}

// extractPackagePath extracts package path from type path
// Example: "helm.sh/helm/v3/pkg/chart.Metadata" -> "helm.sh/helm/v3/pkg/chart"
func extractPackagePath(typePath string) string {
	lastDot := strings.LastIndex(typePath, ".")
	if lastDot == -1 {
		return typePath
	}
	return typePath[:lastDot]
}

// enrichSchemaWithComments adds field descriptions from Go comments to JSON Schema
func enrichSchemaWithComments(schema *jsonschema.Schema, comments CommentMap, typePath string) {
	if schema.Definitions == nil {
		return
	}

	// Get package path and type name
	packagePath := extractPackagePath(typePath)
	lastDot := strings.LastIndex(typePath, ".")
	if lastDot == -1 {
		return
	}
	rootTypeName := typePath[lastDot+1:]

	// Enrich each definition
	for defName, defSchema := range schema.Definitions {
		// Try to match this definition to comments
		fullTypeName := packagePath + "." + defName
		fieldComments, ok := comments[fullTypeName]
		if !ok {
			// Also try with root type name
			fullTypeName = packagePath + "." + rootTypeName
			fieldComments, ok = comments[fullTypeName]
			if !ok {
				continue
			}
		}

		// Add descriptions to properties
		if defSchema.Properties != nil {
			for pair := defSchema.Properties.Oldest(); pair != nil; pair = pair.Next() {
				fieldName := pair.Key
				propSchema := pair.Value

				// Convert JSON field name to Go field name (capitalize first letter)
				goFieldName := strings.ToUpper(fieldName[:1]) + fieldName[1:]
				if desc, ok := fieldComments[goFieldName]; ok && desc != "" {
					propSchema.Description = desc
				}
			}
		}
	}
}

func parseFlags() Config {
	var config Config
	flag.StringVar(&config.TypePath, "type", "", "Go type path (package.Type)")
	flag.BoolVar(&config.AllowAdditional, "allow-additional", false, "Allow additional properties")
	flag.BoolVar(&config.Expanded, "expanded", false, "Generate expanded definitions")
	flag.Parse()

	if config.TypePath == "" {
		fmt.Fprintf(os.Stderr, "Error: --type is required\n\n")
		flag.Usage()
		os.Exit(1)
	}

	return config
}

func generateSchema(typeValue interface{}, config Config) (*jsonschema.Schema, error) {
	reflector := jsonschema.Reflector{
		AllowAdditionalProperties: config.AllowAdditional,
		ExpandedStruct:            config.Expanded,
		DoNotReference:            false,
	}

	return reflector.Reflect(typeValue), nil
}

func getType(typePath string) (interface{}, error) {
	typeValue, ok := typeRegistry[typePath]
	if !ok {
		return nil, fmt.Errorf("type %s not registered.\n\nAvailable types:\n%s", typePath, listAvailableTypes())
	}
	return typeValue, nil
}

func listAvailableTypes() string {
	var types []string
	for k := range typeRegistry {
		types = append(types, "  - "+k)
	}
	return strings.Join(types, "\n")
}
