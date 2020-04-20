import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Color, ImageType } from './enums';
import * as walk from 'walk';
import * as path from 'path';

export const extnames: { [index: string]: ImageType } = {
    png: ImageType.png,
    jpg: ImageType.jpeg,
    jpeg: ImageType.jpeg,
    webp: ImageType.webp,
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
    const inputDir = process.env.INPUT_DIR!;
    const outputDir = process.env.OUTPUT_DIR!;
    for (const variable of [host, inputDir, outputDir]) {
        if (!variable) {
            log('Missing "HOST", "INPUT_DIR" or "OUTPUT_DIR"', true);
        }
    }
    const proxy = process.env.PROXY;
    const followTypeStr = process.env.FOLLOW_TYPE;
    const followType = !!(followTypeStr && followTypeStr === 'true');
    let allTo = process.env.ALL_TO;
    if (!allTo) {
        allTo = ImageType.jpeg;
    } else if (!Object.values(ImageType).includes(allTo as ImageType)) {
        log('Wrong "ALL_TO" type', true);
    }
    return { host, proxy, inputDir, outputDir, followType, allTo };
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

export function log(msg: string, isError = false) {
    console.log(`${colorize(`[${new Date().toISOString()}]`, Color.green)}${isError ? colorize(msg, Color.red) : msg}`);
    if (isError) {
        process.exit(1);
    }
}
