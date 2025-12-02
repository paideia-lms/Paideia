// read gem
import { readFile } from "fs/promises";

const file = await readFile("fixture/gem.png");
const base64 = file.toString("base64");
console.log(base64.substring(0, 100));