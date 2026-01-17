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

	// Generate schema
	schema, err := generateSchema(typeValue, config)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating schema: %v\n", err)
		os.Exit(1)
	}

	// Output JSON
	output, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
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
