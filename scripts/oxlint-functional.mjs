// eslint-plugin-functional for oxlint. Oxlint's JS plugins get no TypeScript
// type information, and `immutable-data` asks for it to decide whether a
// method call such as `.push()` or `.set()` mutates an array, map or set. That
// listener is dropped here; assignments, `delete` and `++`/`--` still report.
import functional from "eslint-plugin-functional";

const immutableData = functional.rules["immutable-data"];

export default {
  meta: { name: "functional" },
  rules: {
    ...functional.rules,
    "immutable-data": {
      ...immutableData,
      create(context) {
        const { CallExpression: _typeAware, ...listeners } = immutableData.create(context);
        return listeners;
      },
    },
  },
};
