package main

import (
	"go/ast"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/tools/go/packages"
)

// CommentMap holds field comments for structs
type CommentMap map[string]map[string]string // packagePath.TypeName -> fieldName -> description

// ExtractComments extracts struct field comments from Go source code
func ExtractComments(packagePath string) (CommentMap, error) {
	// Load the package with full type info and syntax
	// Set Dir to the directory containing go.mod (tools/go-schema-gen)
	// This ensures packages.Load can find dependencies regardless of where the binary is run from
	cfg := &packages.Config{
		Mode: packages.NeedName | packages.NeedFiles | packages.NeedSyntax | packages.NeedTypes | packages.NeedTypesInfo,
		Dir:  getModuleDir(),
	}

	pkgs, err := packages.Load(cfg, packagePath)
	if err != nil {
		return nil, err
	}

	if len(pkgs) == 0 {
		return nil, nil
	}

	pkg := pkgs[0]
	commentMap := make(CommentMap)

	// Process each file in the package
	for _, file := range pkg.Syntax {
		// Traverse AST to find struct types and their field comments
		ast.Inspect(file, func(n ast.Node) bool {
			typeSpec, ok := n.(*ast.TypeSpec)
			if !ok {
				return true
			}

			structType, ok := typeSpec.Type.(*ast.StructType)
			if !ok {
				return true
			}

			// This is a struct type
			structKey := pkg.PkgPath + "." + typeSpec.Name.Name
			fieldComments := make(map[string]string)

			// Extract field comments
			for _, field := range structType.Fields.List {
				if field.Doc != nil && len(field.Names) > 0 {
					fieldName := field.Names[0].Name
					comment := strings.TrimSpace(field.Doc.Text())
					if comment != "" {
						fieldComments[fieldName] = comment
					}
				}
			}

			if len(fieldComments) > 0 {
				commentMap[structKey] = fieldComments
			}

			return true
		})
	}

	return commentMap, nil
}

// GetFieldDescription retrieves the description for a specific struct field
func (cm CommentMap) GetFieldDescription(packagePath, typeName, fieldName string) string {
	structKey := packagePath + "." + typeName
	if fields, ok := cm[structKey]; ok {
		return fields[fieldName]
	}
	return ""
}

// getModuleDir returns the directory containing go.mod
// This function searches for go.mod starting from the executable's directory
func getModuleDir() string {
	// Get the executable path
	exePath, err := os.Executable()
	if err != nil {
		return "."
	}

	// Resolve symlinks
	exePath, err = filepath.EvalSymlinks(exePath)
	if err != nil {
		return "."
	}

	// Start from the directory containing the executable
	dir := filepath.Dir(exePath)

	// Check specific known locations first (for dist/bin/go-schema-gen)
	// Try ../../tools/go-schema-gen (when binary is in dist/bin/)
	toolsDir := filepath.Join(dir, "..", "..", "tools", "go-schema-gen")
	if _, err := os.Stat(filepath.Join(toolsDir, "go.mod")); err == nil {
		return toolsDir
	}

	// Search up the directory tree for go.mod
	for {
		goModPath := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			return dir
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached the root without finding go.mod
			break
		}
		dir = parent
	}

	// Fallback to current directory
	return "."
}
