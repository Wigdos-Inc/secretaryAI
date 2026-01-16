/**
 * @global Helper Functions/Classes
 *
 * Module for reusable functions and small classes. 
 * Examples:
 * - HTML/DOM element builders
 * - Database/storage interactions
 * - Data sorting, filtering, transformation, and general manipulation
 * - Formatting and parsing helpers (dates, numbers, strings)
 * - Data validation
 *
 * These are for general, reusable use.
 * If a function becomes feature specific, either make it a sub-feature in your code process or copy the code and adapt it for your use case.
 *
 * @module scripts/helper.js
 */


/**
 * Use Guide for ES6 Module:
 * 
 * - Syntax here: Add "export " before function/class declarations
 *   - Example: export function dateFormat(param1, param2) { code... }
 * 
 * - Syntax in other js files: Add import at the top of the file, referring to this file.
 *   - Example: import { functionName, functionName } from "path/helper.js";
 * 
 * - Syntax for HTML files using modules: Add "type='module'" to the <script> tag.
 *   - Example: <script type="module" src="path/index.html"
 *   - Effect: For that page, the attached script file can now use this helper module
 */