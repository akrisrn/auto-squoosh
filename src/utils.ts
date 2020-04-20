import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { imageType } from './enums';
import * as walk from 'walk';
import * as path from 'path';

export const extnames: { [index: string]: imageType } = {
    png: imageType.png,
    jpg: imageType.jpeg,
    jpeg: imageType.jpeg,
    webp: imageType.webp,
};

export function loadConfig() {
    ['.env', '.env.local'].forEach(filename => {
        if (fs.existsSync(filename)) {
            const config = dotenv.parse(fs.readFileSync(filename));
            Object.keys(config).forEach(key => {
                process.env[key] = config[key];
            });
        }
    });
    const host = process.env.HOST!;
    const proxy = process.env.PROXY;
    const inputDir = process.env.INPUT_DIR!;
    const outputDir = process.env.OUTPUT_DIR!;
    for (const variable of [host, inputDir, outputDir]) {
        if (!variable) process.exit(1);
    }
    return { host, proxy, inputDir, outputDir };
}

export function getSelector() {
    const selectBtn = 'file-drop p > button';
    const panel = 'file-drop > div > div:last-of-type';
    const downloadLink = `${panel} > div:last-of-type > div:last-of-type > a`;
    const savingSpan = `${panel} > div:last-of-type > div:first-of-type > span > span`;
    const optionPanel = `${panel} > div:first-of-type`;
    const typeSelect = `${optionPanel} > section select`;
    return { selectBtn, panel, downloadLink, savingSpan, optionPanel, typeSelect };
}

export function getFiles(inputDir: string) {
    const extnameList = Object.keys(extnames);
    const files: string[] = [];
    walk.walkSync(inputDir, {
        listeners: {
            file: (root, fileStats, next) => {
                const filename = fileStats.name;
                const extname = path.extname(filename).substr(1);
                if (extnameList.includes(extname)) {
                    files.push(path.join(root, filename));
                }
                next();
            },
        },
    });
    return files;
}

export function colorize(msg: string, color: number) {
    return `\x1B[${color}m${msg}\x1B[0m`;
}
