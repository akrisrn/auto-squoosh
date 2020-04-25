import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { Color, ImageType, imageTypes, ResizePreset, VarType } from './enums';
import * as walk from 'walk';
import * as path from 'path';
import { imageSize } from 'image-size';
import { CustomRule, ImageFile } from './d';

let allowAllType = false;
const allowedTypes: ImageType[] = [];

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
    const excludeFilesStr = check('EXCLUDE_FILES', process.env.EXCLUDE_FILES, VarType.isList);
    const excludeFiles = excludeFilesStr ? excludeFilesStr.split(',') : [];
    const maxParallel = parseInt(check('MAX_PARALLEL', process.env.MAX_PARALLEL, VarType.inRangeOrEmpty, [1, 10], '5'), 10);
    const abortSlight = Boolean(check('ABORT_SLIGHT', process.env.ABORT_SLIGHT, VarType.isBool, [], 'false'));
    const abortBigger = Boolean(check('ABORT_BIGGER', process.env.ABORT_BIGGER, VarType.isBool, [], 'false'));
    const suffix = check('SUFFIX', process.env.SUFFIX, VarType.whatever);
    const overwrite = Boolean(check('OVERWRITE', process.env.OVERWRITE, VarType.isBool, [], 'false'));
    const furtherAbort = Boolean(check('FURTHER_ABORT', process.env.FURTHER_ABORT, VarType.isBool, [], 'false'));
    const offsetSize = parseInt(check('OFFSET_SIZE', process.env.OFFSET_SIZE, VarType.inRangeOrEmpty, [1, 100], '1'), 10);
    const followPath = Boolean(check('FOLLOW_PATH', process.env.FOLLOW_PATH, VarType.isBool, [], 'true'));
    const CUSTOM_RULES = 'CUSTOM_RULES';
    const customRulesStr = check(CUSTOM_RULES, process.env.CUSTOM_RULES, VarType.isList);
    const sep = '->';
    const customRules = customRulesStr ? [...new Set(customRulesStr.split(',').map(rule => {
        const customRule = [];
        const indexOf = rule.indexOf(sep);
        if (indexOf >= 0 && indexOf === rule.lastIndexOf(sep)) {
            const [inputType, outputType] = rule.split(sep).map(type => type.trim());
            check(`input type of ${CUSTOM_RULES}`, inputType, VarType.inListOrEmpty, imageTypes);
            check(`output type of ${CUSTOM_RULES}`, outputType, VarType.inListOrEmpty, imageTypes);
            if (!inputType) {
                if (allowAllType) {
                    error(`Only allow to omit input type once in "${CUSTOM_RULES}"`);
                }
                allowAllType = true;
            } else if (!allowedTypes.includes(inputType as ImageType)) {
                allowedTypes.push(inputType as ImageType);
            }
            customRule.push(inputType);
            customRule.push(outputType ? outputType : ImageType.jpeg);
        } else {
            error(`Wrong "${CUSTOM_RULES}"`);
        }
        return customRule.join(sep);
    }))].sort(rule => rule.endsWith(ImageType.jpeg) ? rule.startsWith(sep) ? 1 : -1 : 0).map(rule => {
        const [inputType, outputType] = rule.split(sep);
        return { inputType, outputType } as CustomRule;
    }) : [];
    const followType = Boolean(check('FOLLOW_TYPE', process.env.FOLLOW_TYPE, VarType.isBool, [], 'false'));
    if (customRules.length === 0 && followType) {
        allowAllType = true;
        for (const imageType of imageTypes) {
            customRules.push({
                inputType: imageType,
                outputType: imageType,
            });
        }
    }
    const allTo = check('ALL_TO', process.env.ALL_TO, VarType.inListOrEmpty, imageTypes, ImageType.jpeg) as ImageType;
    if (customRules.length === 0) {
        allowAllType = true;
        customRules.push({ outputType: allTo });
    }
    const pngEffort = check('PNG_EFFORT', process.env.PNG_EFFORT, VarType.inRangeOrEmpty, [0, 3], '2');
    const jpegQuality = check('JPEG_QUALITY', process.env.JPEG_QUALITY, VarType.inRangeOrEmpty, [0, 100], '75');
    const webpEffort = check('WEBP_EFFORT', process.env.WEBP_EFFORT, VarType.inRangeOrEmpty, [0, 6], '4');
    const webpQuality = check('WEBP_QUALITY', process.env.WEBP_QUALITY, VarType.inRangeOrEmpty, [0, 100], '75');
    const resizeWidth = check('RESIZE_WIDTH', process.env.RESIZE_WIDTH, VarType.inRangeOrEmpty, [1, 10000]);
    const scaleUp = Boolean(check('SCALE_UP', process.env.SCALE_UP, VarType.isBool, [], 'false'));
    const resizePreset = check('RESIZE_PRESET', process.env.RESIZE_PRESET, VarType.inListOrEmpty, Object.values(ResizePreset), ResizePreset['100%']) as ResizePreset;
    return {
        host,
        proxy,
        inputDir,
        outputDir,
        excludeDirs,
        excludeFiles,
        maxParallel,
        abortSlight,
        abortBigger,
        suffix,
        overwrite,
        furtherAbort,
        offsetSize,
        followPath,
        customRules,
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

export function getImageFiles(inputDir: string, excludeDirs: string[], excludeFiles: string[]) {
    const imageFiles: ImageFile[] = [];
    walk.walkSync(inputDir, {
        listeners: {
            file: (root, fileStats, next) => {
                const filename = fileStats.name;
                let isExclude = false;
                for (const excludeFile of excludeFiles) {
                    const regexp = new RegExp(excludeFile);
                    if (regexp.test(filename)) {
                        isExclude = true;
                        break;
                    }
                }
                if (!isExclude) {
                    const fileType = getFileType(filename);
                    if (fileType && (allowAllType || allowedTypes.includes(fileType))) {
                        const filepath = path.join(root, filename);
                        const dimensions = imageSize(filepath);
                        imageFiles.push({
                            path: filepath,
                            width: dimensions.width!,
                            height: dimensions.height!,
                        });
                    }
                }
                next();
            },
        },
        filters: excludeDirs,
    });
    return imageFiles;
}

export function getFileType(filename: string) {
    switch (path.extname(filename).substr(1)) {
        case 'png':
            return ImageType.png;
        case 'jpg':
        case 'jpeg':
            return ImageType.jpeg;
        case 'webp':
            return ImageType.webp;
    }
}

export function getTypeExtname(type: ImageType) {
    switch (type) {
        case ImageType.png:
            return 'png';
        case ImageType.jpeg:
            return 'jpg';
        case ImageType.webp:
            return 'webp';
    }
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
