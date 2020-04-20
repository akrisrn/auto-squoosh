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
    const allTo = process.env.ALL_TO;
    if (allTo) {
        if (!Object.values(ImageType).includes(allTo as ImageType)) {
            log('Wrong "ALL_TO" type', true);
        }
    }
    const checkRange = (name: string, value: string, isQuality = true) => {
        let num = parseInt(value);
        if (isNaN(num)) {
            log(`"${name}" isn't a number`, true);
        }
        const min = 0;
        let max = 100;
        if (!isQuality) {
            max = 6;
        }
        if (num < min) {
            num = min;
        } else if (num > max) {
            num = max;
        }
        return num.toString();
    };
    let pngEffort = process.env.PNG_EFFORT;
    if (pngEffort) {
        pngEffort = checkRange('PNG_EFFORT', pngEffort, false);
    }
    let jpegQuality = process.env.JPEG_QUALITY;
    if (jpegQuality) {
        jpegQuality = checkRange('JPEG_QUALITY', jpegQuality);
    }
    let webpEffort = process.env.WEBP_EFFORT;
    if (webpEffort) {
        webpEffort = checkRange('WEBP_EFFORT', webpEffort, false);
    }
    let webpQuality = process.env.WEBP_QUALITY;
    if (webpQuality) {
        webpQuality = checkRange('WEBP_QUALITY', webpQuality);
    }
    return { host, proxy, inputDir, outputDir, followType, allTo, pngEffort, jpegQuality, webpEffort, webpQuality };
}

export function getSelector() {
    const panel = 'file-drop > div > div:last-of-type';
    const optionPanel = `${panel} > div:first-of-type`;
    const downloadPanel = `${panel} > div:last-of-type`;

    const selectBtn = 'file-drop p > button';
    const typeSelect = `${optionPanel} > section select`;
    const pngEffortInput = `${optionPanel} form range-input`;
    const jpegQualityInput = pngEffortInput;
    const webpEffortInput = `${optionPanel} form > div > div:first-of-type range-input`;
    const webpQualityInput = `${optionPanel} form > div > div:nth-of-type(2) range-input`;
    const savingSpan = `${downloadPanel} > div:first-of-type > span > span`;
    const downloadLink = `${downloadPanel} > div:last-of-type > a`;
    const loadingSpinner = `${downloadPanel} loading-spinner`;
    return {
        selectBtn,
        typeSelect,
        pngEffortInput,
        jpegQualityInput,
        webpEffortInput,
        webpQualityInput,
        savingSpan,
        downloadLink,
        loadingSpinner,
    };
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
