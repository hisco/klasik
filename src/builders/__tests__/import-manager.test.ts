import { Project } from 'ts-morph';
import { ImportManager } from '../import-manager';

describe('ImportManager', () => {
  let project: Project;

  beforeEach(() => {
    project = new Project({ useInMemoryFileSystem: true });
  });

  describe('addImport', () => {
    it('should add a single named import', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios');

      expect(manager.hasImport('axios')).toBe(true);
      expect(manager.hasNamedImport('axios', 'Axios')).toBe(true);
    });

    it('should add multiple named imports', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios', 'AxiosResponse');

      expect(manager.getNamedImports('axios')).toEqual(['Axios', 'AxiosResponse']);
    });

    it('should deduplicate named imports', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios');
      manager.addImport('axios', 'Axios');
      manager.addImport('axios', 'AxiosResponse');

      expect(manager.getNamedImports('axios')).toHaveLength(2);
    });
  });

  describe('addImports', () => {
    it('should add multiple imports from different modules', () => {
      const manager = new ImportManager();
      manager.addImports({
        'axios': ['Axios', 'AxiosResponse'],
        'class-transformer': ['Expose', 'Type'],
      });

      expect(manager.hasImport('axios')).toBe(true);
      expect(manager.hasImport('class-transformer')).toBe(true);
      expect(manager.getNamedImports('axios')).toHaveLength(2);
      expect(manager.getNamedImports('class-transformer')).toHaveLength(2);
    });
  });

  describe('applyToSourceFile', () => {
    it('should apply imports to source file', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios');
      manager.addImport('class-transformer', 'Expose', 'Type');

      const sourceFile = project.createSourceFile('test.ts');
      manager.applyToSourceFile(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      expect(imports).toHaveLength(2);

      const axiosImport = imports.find(imp =>
        imp.getModuleSpecifierValue() === 'axios'
      );
      expect(axiosImport?.getNamedImports().map(ni => ni.getName())).toEqual(['Axios']);

      const ctImport = imports.find(imp =>
        imp.getModuleSpecifierValue() === 'class-transformer'
      );
      expect(ctImport?.getNamedImports().map(ni => ni.getName())).toEqual(['Expose', 'Type']);
    });

    it('should sort imports (external first, then relative)', () => {
      const manager = new ImportManager();
      manager.addImport('./models/user', 'User');
      manager.addImport('axios', 'Axios');
      manager.addImport('./models/admin', 'Admin');
      manager.addImport('class-transformer', 'Expose');

      const sourceFile = project.createSourceFile('test.ts');
      manager.applyToSourceFile(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      const paths = imports.map(imp => imp.getModuleSpecifierValue());

      expect(paths[0]).toBe('axios');
      expect(paths[1]).toBe('class-transformer');
      expect(paths[2]).toBe('./models/admin');
      expect(paths[3]).toBe('./models/user');
    });

    it('should sort named imports alphabetically', () => {
      const manager = new ImportManager();
      manager.addImport('class-transformer', 'Type', 'Expose', 'Transform');

      const sourceFile = project.createSourceFile('test.ts');
      manager.applyToSourceFile(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      const namedImports = imports[0].getNamedImports().map(ni => ni.getName());

      expect(namedImports).toEqual(['Expose', 'Transform', 'Type']);
    });
  });

  describe('ESM mode', () => {
    it('should add .js extensions to relative imports', () => {
      const manager = new ImportManager({ esm: true });
      manager.addImport('./models/user', 'User');
      manager.addImport('axios', 'Axios');

      const sourceFile = project.createSourceFile('test.ts');
      manager.applyToSourceFile(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      const userImport = imports.find(imp =>
        imp.getModuleSpecifierValue().includes('user')
      );

      expect(userImport?.getModuleSpecifierValue()).toBe('./models/user.js');
    });

    it('should not add .js to external imports', () => {
      const manager = new ImportManager({ esm: true });
      manager.addImport('axios', 'Axios');

      const sourceFile = project.createSourceFile('test.ts');
      manager.applyToSourceFile(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      expect(imports[0].getModuleSpecifierValue()).toBe('axios');
    });

    it('should not double-add .js extension', () => {
      const manager = new ImportManager({ esm: true });
      manager.addImport('./models/user.js', 'User');

      const sourceFile = project.createSourceFile('test.ts');
      manager.applyToSourceFile(sourceFile);

      const imports = sourceFile.getImportDeclarations();
      expect(imports[0].getModuleSpecifierValue()).toBe('./models/user.js');
    });
  });

  describe('utility methods', () => {
    it('should clear all imports', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios');
      manager.addImport('class-transformer', 'Expose');

      manager.clear();

      expect(manager.hasImport('axios')).toBe(false);
      expect(manager.hasImport('class-transformer')).toBe(false);
    });

    it('should convert to record', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios', 'AxiosResponse');
      manager.addImport('class-transformer', 'Expose');

      const record = manager.toRecord();

      expect(record).toEqual({
        'axios': ['Axios', 'AxiosResponse'],
        'class-transformer': ['Expose'],
      });
    });

    it('should clone manager', () => {
      const manager = new ImportManager();
      manager.addImport('axios', 'Axios');

      const cloned = manager.clone();
      cloned.addImport('axios', 'AxiosResponse');

      expect(manager.getNamedImports('axios')).toHaveLength(1);
      expect(cloned.getNamedImports('axios')).toHaveLength(2);
    });
  });
});
