import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = path.join(root, "src/entities/product/ui/ProductModelsGrid/ProductModelsGrid.tsx");
const source = fs.readFileSync(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const imageByIdentifier = new Map();
let productDeclaration;

for (const statement of sourceFile.statements) {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    const imageImport = statement.moduleSpecifier.text;
    const identifier = statement.importClause?.name?.text;
    if (identifier && imageImport.includes("/images/png/hastings/")) {
      imageByIdentifier.set(identifier, `images/${path.basename(imageImport)}`);
    }
  }

  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(sourceFile) === "productMockData") productDeclaration = declaration;
    }
  }
}

const unwrap = (node) => {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
};

const evaluate = (input) => {
  const node = unwrap(input);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node)) {
    if (imageByIdentifier.has(node.text)) return imageByIdentifier.get(node.text);
    throw new Error(`Unsupported identifier: ${node.text}`);
  }
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    return -Number(evaluate(node.operand));
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluate);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) throw new Error(`Unsupported property: ${property.getText(sourceFile)}`);
        const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
          ? property.name.text
          : property.name.getText(sourceFile);
        return [key, evaluate(property.initializer)];
      }),
    );
  }
  throw new Error(`Unsupported expression: ${ts.SyntaxKind[node.kind]} ${node.getText(sourceFile).slice(0, 80)}`);
};

if (!productDeclaration?.initializer || !ts.isCallExpression(productDeclaration.initializer)) {
  throw new Error("productMockData initializer was not found");
}

const mappedSource = productDeclaration.initializer.expression;
if (!ts.isPropertyAccessExpression(mappedSource)) throw new Error("Expected productMockData.map(...)");
const products = evaluate(mappedSource.expression);

const computeSize = (title) => {
  const inches = Number(title.match(/(\d+)"/)?.[1] ?? 0);
  if (inches < 30) return "24_29";
  if (inches < 40) return "30_39";
  if (inches < 50) return "40_49";
  if (inches < 60) return "50_59";
  if (inches < 70) return "60_69";
  if (inches < 80) return "70_79";
  if (inches < 90) return "80_89";
  return "90_plus";
};

const computeStyles = (presetProducts) => {
  const styles = [];
  if (presetProducts.some((product) => product.Drawers === "1D")) styles.push("1_drawer");
  if (presetProducts.some((product) => product.Drawers === "2D")) styles.push("2_drawer");
  const sinkBases = presetProducts.filter((product) => product.name === "Sink-Base" && product.sinkType);
  if (sinkBases.length === 1) styles.push("single_basin");
  if (sinkBases.length >= 2) styles.push("double_basin");
  if (presetProducts.some((product) => product.name === "Open-Shelf")) styles.push("open_shelving");
  if (presetProducts.length >= 2) {
    const symmetric = presetProducts.every((product, index) => {
      const opposite = presetProducts[presetProducts.length - 1 - index];
      return index >= presetProducts.length / 2 || (product.name === opposite.name && product.Width === opposite.Width);
    });
    if (!symmetric) styles.push("asymmetrical");
  }
  return styles;
};

const migrated = products.map((product) => ({
  ...product,
  size: computeSize(product.title),
  style: computeStyles(product.presetProducts),
}));

const productCount = migrated.reduce((sum, preset) => sum + preset.presetProducts.length, 0);
if (migrated.length !== 54 || productCount !== 123) {
  throw new Error(`Unexpected catalog size: ${migrated.length} presets and ${productCount} products`);
}

const collectionDir = path.join(root, "public/collections/urban-standard-height");
const imageDir = path.join(collectionDir, "images");
fs.mkdirSync(imageDir, { recursive: true });
fs.writeFileSync(path.join(collectionDir, "presets.json"), `${JSON.stringify(migrated, null, 2)}\n`);

for (const imageReference of new Set(migrated.map((product) => product.img))) {
  const filename = path.basename(imageReference);
  fs.copyFileSync(
    path.join(root, "src/shared/assets/images/png/hastings", filename),
    path.join(imageDir, filename),
  );
}

console.log(`Migrated ${migrated.length} presets, ${productCount} products, and ${new Set(migrated.map((p) => p.img)).size} images.`);
