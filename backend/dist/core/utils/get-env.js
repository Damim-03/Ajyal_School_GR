"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = void 0;
const getEnv = (key, defaultValue) => {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Missing env variable: ${key}`);
    }
    return value;
};
exports.getEnv = getEnv;
//# sourceMappingURL=get-env.js.map