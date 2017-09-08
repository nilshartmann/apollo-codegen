import * as fs from 'fs';

import { loadSchema, loadAndMergeQueryDocuments } from './loading';
import { validateQueryDocument } from './validation';
import { compileToIR } from './compiler';
import { compileToLegacyIR } from './compiler/legacyIR';
import serializeToJSON from './serializeToJSON';
import { generateSource as generateSwiftSource } from './swift';
import { generateSource as generateTypescriptSource } from './typescript';
import { generateSource as generateFlowSource } from './flow';
import { generateSource as generateFlowModernSource } from './flow-modern';
import { generateSource as generateScalaSource } from './scala';

export const TargetType = {
  json: 'json',
  swift: 'swift',
  ts: 'ts',
  typescript: 'typescript',
  flow: 'flow',
  'flow-modern': 'flow-modern',
  scala: 'scala'
};
export const TARGETS = Object.keys(TargetType);

export default function generate(
  inputPaths: string[],
  schemaPath: string,
  outputPath: string,
  target: keyof typeof TargetType,
  tagName: string,
  options: any
) {
  const schema = loadSchema(schemaPath);

  const document = loadAndMergeQueryDocuments(inputPaths, tagName);

  validateQueryDocument(schema, document, target);

  let output;

  if (target === 'swift') {
    options.addTypename = true;
    const context = compileToIR(schema, document, options);
    output = generateSwiftSource(context);
    if (options.generateOperationIds) {
      writeOperationIdsMap(context);
    }
  } else if (target === 'flow-modern') {
    options.addTypename = true;
    const context = compileToIR(schema, document, options);
    output = generateFlowModernSource(context);
  } {
    const context = compileToLegacyIR(schema, document, options);
    switch (target) {
      case 'json':
        output = serializeToJSON(context);
        break;
      case 'ts':
      case 'typescript':
        output = generateTypescriptSource(context);
        break;
      case 'flow':
        output = generateFlowSource(context);
        break;
      case 'scala':
        output = generateScalaSource(context, options);
    }
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, output);
  } else {
    console.log(output);
  }
}

interface OperationIdsMap {
  name: string;
  source: string;
}

function writeOperationIdsMap(context: any) {
  let operationIdsMap: { [id: string]: OperationIdsMap } = {};
  Object.values(context.operations).forEach(operation => {
    operationIdsMap[operation.operationId] = {
      name: operation.operationName,
      source: operation.sourceWithFragments
    };
  });
  fs.writeFileSync(context.operationIdsPath, JSON.stringify(operationIdsMap, null, 2));
}
