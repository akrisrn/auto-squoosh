import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Color, ImageType, ResizePreset, VarType } from './enums';
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
    const check = (name: string, value: string | undefined, type: VarType, list: string[] | number[] = [], defaultValue: string = '') => {
        value = value === undefined ? '' : value.trim();
        if (!value) {
            value = defaultValue;
        }
        switch (type) {
            case VarType.notEmpty:
                if (!value) {
                    error(`Missing "${name}"`);
                }
                break;
            case VarType.inListOrEmpty:
                if (value && !(list as string[]).includes(value)) {
                    error(`Wrong "${name}"`);
                }
                break;
            case VarType.inRangeOrEmpty:
                if (value) {
                    let num = parseInt(value, 10);
                    if (isNaN(num)) {
                        error(`"${name}" isn't a number`);
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
            case VarType.isList:
                if (value.indexOf(',') >= 0) {
                    value = value.split(',').map(v => v.trim()).filter(v => v).join();
                    if (!value) {
                        value = defaultValue;
                    }
                    return value;
                }
                break;
            case VarType.isBool:
                if (value !== 'true') {
                    return '';
                }
                break;
            case VarType.whatever:
                break;
        }
        return value;
    };
    const host = check('HOST', process.env.HOST, VarType.notEmpty, [], 'https://squoosh.app/');
    const proxy = check('PROXY', process.env.PROXY, VarType.whatever);
    const inputDir = check('INPUT_DIR', process.env.INPUT_DIR, VarType.notEmpty);
    const outputDir = check('OUTPUT_DIR', process.env.OUTPUT_DIR, VarType.notEmpty);
    const excludeDirs = check('EXCLUDE_DIRS', process.env.EXCLUDE_DIRS, VarType.isList, [], '.git,node_modules').split(',');
    const maxParallel = parseInt(check('MAX_PARALLEL', process.env.MAX_PARALLEL, VarType.inRangeOrEmpty, [1, 10], '5'), 10);
    const overwrite = Boolean(check('OVERWRITE', process.env.OVERWRITE, VarType.isBool, [], 'false'));
    const followPath = Boolean(check('FOLLOW_PATH', process.env.FOLLOW_PATH, VarType.isBool, [], 'true'));
    const followType = Boolean(check('FOLLOW_TYPE', process.env.FOLLOW_TYPE, VarType.isBool, [], 'false'));
    const allTo = check('ALL_TO', process.env.ALL_TO, VarType.inListOrEmpty, Object.values(ImageType), ImageType.jpeg);
    const pngEffort = check('PNG_EFFORT', process.env.PNG_EFFORT, VarType.inRangeOrEmpty, [0, 6], '2');
    const jpegQuality = check('JPEG_QUALITY', process.env.JPEG_QUALITY, VarType.inRangeOrEmpty, [0, 100], '75');
    const webpEffort = check('WEBP_EFFORT', process.env.WEBP_EFFORT, VarType.inRangeOrEmpty, [0, 6], '4');
    const webpQuality = check('WEBP_QUALITY', process.env.WEBP_QUALITY, VarType.inRangeOrEmpty, [0, 100], '75');
    const resizeWidth = check('RESIZE_WIDTH', process.env.RESIZE_WIDTH, VarType.inRangeOrEmpty, [1, 10000]);
    const scaleUp = Boolean(check('SCALE_UP', process.env.SCALE_UP, VarType.isBool, [], 'false'));
    const resizePreset = check('RESIZE_PRESET', process.env.RESIZE_PRESET, VarType.inListOrEmpty, Object.values(ResizePreset), ResizePreset['100%']);
    return {
        host,
        proxy,
        inputDir,
        outputDir,
        excludeDirs,
        maxParallel,
        overwrite,
        followPath,
        followType,
        allTo,
        pngEffort,
        jpegQuality,
        webpEffort,
        webpQuality,
        resizeWidth,
        scaleUp,
        resizePreset,
    };
}

export function getSelector() {
    const rightDiv = 'file-drop > div > div:last-of-type';
    const optionDiv = `${rightDiv} > div:first-of-type`;
    const editDiv = `${optionDiv} > div:first-of-type > div`;
    const resizeForm = `${editDiv} > div:first-of-type > form`;
    const compressForm = `${optionDiv} > div:last-of-type > form`;
    const downloadDiv = `${rightDiv} > div:last-of-type`;

    const selectBtn = 'file-drop p > button';
    const resizeLabel = `${editDiv} > label:first-of-type`;
    const resizePresetSelect = `${resizeForm} > label:nth-of-type(2) select`;
    const resizeWidthInput = `${resizeForm} > label:nth-of-type(3) > input`;
    const typeSelect = `${optionDiv} > section select`;
    const pngEffortInput = `${compressForm} range-input`;
    const jpegQualityInput = pngEffortInput;
    const webpEffortInput = `${compressForm} > div > div:first-of-type range-input`;
    const webpQualityInput = `${compressForm} > div > div:nth-of-type(2) range-input`;
    const savingSpan = `${downloadDiv} > div:first-of-type > span > span`;
    const downloadLink = `${downloadDiv} > div:last-of-type > a`;
    const loadingSpinner = `${downloadDiv} loading-spinner`;
    return {
        selectBtn,
        resizeLabel,
        resizePresetSelect,
        resizeWidthInput,
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

export function getFiles(inputDir: string, excludeDirs: string[]) {
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
        filters: excludeDirs,
    });
    return files;
}

export function colorize(msg: string, color: Color) {
    return `\x1B[${color}m${msg}\x1B[0m`;
}

export function log(msg: any) {
    console.log(`${colorize(`[${new Date().toISOString()}]`, Color.green)}${msg}`);
}

export function error(msg: any) {
    log(colorize(msg, Color.red));
    process.exit(1);
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
