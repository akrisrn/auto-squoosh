import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Color, ImageType, VarType } from './enums';
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
    const check = (name: string, value: string | undefined, type: VarType, list: string[] | number[] = []) => {
        if (value === undefined) value = '';
        switch (type) {
            case VarType.notEmpty:
                if (!value) {
                    log(`Missing "${name}"`, true);
                }
                break;
            case VarType.inListOrEmpty:
                if (value && !(list as string[]).includes(value)) {
                    log(`Wrong "${name}"`, true);
                }
                break;
            case VarType.inRangeOrEmpty:
                if (value) {
                    let num = parseInt(value, 10);
                    if (isNaN(num)) {
                        log(`"${name}" isn't a number`, true);
                    }
                    const [min, max] = list as number[];
                    if (num < min) {
                        num = min;
                    } else if (num > max) {
                        num = max;
                    }
                    return num.toString();
                }
                break;
            case VarType.isBool:
                if (value !== 'true') return '';
                break;
            case VarType.whatever:
                break;
        }
        return value;
    };
    const host = check('HOST', process.env.HOST, VarType.notEmpty);
    const proxy = check('PROXY', process.env.PROXY, VarType.whatever);
    const inputDir = check('INPUT_DIR', process.env.INPUT_DIR, VarType.notEmpty);
    const outputDir = check('OUTPUT_DIR', process.env.OUTPUT_DIR, VarType.notEmpty);
    const override = Boolean(check('OVERRIDE', process.env.OVERRIDE, VarType.isBool));
    const followPath = Boolean(check('FOLLOW_PATH', process.env.FOLLOW_PATH, VarType.isBool));
    const followType = Boolean(check('FOLLOW_TYPE', process.env.FOLLOW_TYPE, VarType.isBool));
    const allTo = check('ALL_TO', process.env.ALL_TO, VarType.inListOrEmpty, Object.values(ImageType));
    const pngEffort = check('PNG_EFFORT', process.env.PNG_EFFORT, VarType.inRangeOrEmpty, [0, 6]);
    const jpegQuality = check('JPEG_QUALITY', process.env.JPEG_QUALITY, VarType.inRangeOrEmpty, [0, 100]);
    const webpEffort = check('WEBP_EFFORT', process.env.WEBP_EFFORT, VarType.inRangeOrEmpty, [0, 6]);
    const webpQuality = check('WEBP_QUALITY', process.env.WEBP_QUALITY, VarType.inRangeOrEmpty, [0, 100]);
    return {
        host,
        proxy,
        inputDir,
        outputDir,
        override,
        followPath,
        followType,
        allTo,
        pngEffort,
        jpegQuality,
        webpEffort,
        webpQuality,
    };
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
