import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { Color, ImageType, ResizePreset } from './enums';
import { colorize, getFileType, getImageFiles, getSelector, getTypeExtname, loadConfig, log, sleep } from './utils';
import * as AsyncLock from 'async-lock';
import { ImageFile } from './d';

const config = loadConfig();
const selector = getSelector();
const lock = new AsyncLock();
let pageCount = 0;

async function selectImage(page: Page, file: ImageFile) {
    log(colorize(`Selecting ${file.path}`, Color.cyan));
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector.selectBtn),
    ]);
    await fileChooser.accept([file.path]);
}

async function setOptions(page: Page, file: ImageFile, outputType: ImageType) {
    log(colorize(`Setting options for ${file.path}`, Color.cyan));
    if (outputType !== ImageType.jpeg) {
        await page.select(selector.typeSelect, outputType);
    }
    const changeInput = await page.evaluateHandle(() => (inputSelector: string, value: string) => {
        const input = document.querySelector<HTMLInputElement>(inputSelector)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
    });
    switch (outputType) {
        case ImageType.png:
            if (config.pngEffort !== '2') {
                await page.evaluateHandle((changeRangeInput, pngEffortInput, pngEffort) => {
                    changeRangeInput(pngEffortInput, pngEffort);
                }, changeInput, selector.pngEffortInput, config.pngEffort);
            }
            break;
        case ImageType.jpeg:
            if (config.jpegQuality !== '75') {
                await page.evaluateHandle((changeRangeInput, jpegQualityInput, jpegQuality) => {
                    changeRangeInput(jpegQualityInput, jpegQuality);
                }, changeInput, selector.jpegQualityInput, config.jpegQuality);
            }
            break;
        case ImageType.webp:
            if (config.webpEffort !== '4') {
                await page.evaluateHandle((changeRangeInput, webpEffortInput, webpEffort) => {
                    changeRangeInput(webpEffortInput, webpEffort);
                }, changeInput, selector.webpEffortInput, config.webpEffort);
            }
            if (config.webpQuality !== '75') {
                await page.evaluateHandle((changeRangeInput, webpQualityInput, webpQuality) => {
                    changeRangeInput(webpQualityInput, webpQuality);
                }, changeInput, selector.webpQualityInput, config.webpQuality);
            }
            break;
    }
    const clickResizeLabel = async () => {
        const checked = await page.evaluate(resizeLabel => {
            return document.querySelector<HTMLInputElement>(`${resizeLabel} input`)!.checked;
        }, selector.resizeLabel);
        if (!checked) {
            await page.click(selector.resizeLabel);
        }
        await sleep(100);
    };
    if (config.resizeWidth) {
        const width = parseInt(config.resizeWidth, 10);
        if (width !== file.width && (config.scaleUp || width < file.width)) {
            await clickResizeLabel();
            await page.evaluateHandle((changeWidthInput, resizeWidthInput, resizeWidth) => {
                changeWidthInput(resizeWidthInput, resizeWidth);
            }, changeInput, selector.resizeWidthInput, config.resizeWidth);
        }
    } else if (config.resizePreset !== ResizePreset['100%']) {
        await clickResizeLabel();
        await page.select(selector.resizePresetSelect, config.resizePreset);
    }
}

async function compressImage(page: Page, file: ImageFile, outputType: ImageType) {
    log(colorize(`Compressing ${file.path}`, Color.blue));
    await page.waitForSelector(`${selector.downloadLink}[download$=".${getTypeExtname(outputType)}"]`, {
        timeout: 0,
    });
    await page.waitForSelector(selector.loadingSpinner, {
        hidden: true,
        timeout: 0,
    });
}

async function writeImage(browser: Browser, page: Page, file: ImageFile, outputDir: string) {
    const { url, filename, size, saving } = await page.evaluate((downloadLink, savingSpan) => {
        const a = document.querySelector<HTMLLinkElement>(downloadLink)!;
        const span = document.querySelector<HTMLSpanElement>(savingSpan)!;
        return {
            url: a.href,
            filename: (a as any).download as string,
            size: span.previousSibling!.textContent!.trim(),
            saving: span.innerText,
        };
    }, selector.downloadLink, selector.savingSpan);
    if (saving === 'no change' || (saving.startsWith('slightly') && config.abortSlight) || (saving.endsWith('bigger') && config.abortBigger)) {
        log(colorize(`Abort write ${filename} (${size} ${saving})`, Color.red));
        return;
    }
    const newPage = await browser.newPage();
    const buffer = await (await newPage.goto(url))!.buffer();
    await newPage.close();
    if (config.followPath) {
        outputDir = path.join(outputDir, path.dirname(file.path).substr(path.join(config.inputDir).length));
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {
            recursive: true,
        });
    }
    let outputPath = path.join(outputDir, filename);
    if (config.suffix) {
        const index = filename.lastIndexOf('.');
        outputPath = path.join(outputDir, filename.substring(0, index) + config.suffix + filename.substring(index));
    }
    if (fs.existsSync(outputPath)) {
        if (!config.overwrite) {
            const extname = path.extname(outputPath);
            const pathNoExt = outputPath.substr(0, outputPath.length - extname.length);
            let index = 1;
            do {
                outputPath = `${pathNoExt} (${index})${extname}`;
                index += 1;
            } while (fs.existsSync(outputPath));
        } else if (config.furtherAbort) {
            const fileSize = fs.statSync(outputPath).size;
            const bufferSize = buffer.length;
            if (bufferSize > fileSize || fileSize - bufferSize <= config.offsetSize * 1024) {
                log(colorize(`Abort overwrite ${outputPath} because bigger or slightly smaller`, Color.red));
                return;
            }
        }
    }
    let savingMsg = `(${size} ${saving})`;
    if (saving.endsWith('smaller')) {
        savingMsg = colorize(savingMsg, Color.green);
    } else {
        savingMsg = colorize(savingMsg, Color.red);
    }
    log(colorize(`Writing ${outputPath} ${savingMsg}`, Color.blue));
    fs.writeFileSync(outputPath, buffer);
}

async function squash(browser: Browser, file: ImageFile, outputDir: string) {
    await lock.acquire('key', async () => {
        pageCount += 1;
        while (pageCount === config.maxParallel + 1) {
            log(colorize('Sleeping', Color.green));
            await sleep(1000);
        }
        log(colorize(`Opening new page ${colorize(`(${pageCount} of ${config.maxParallel})`, Color.green)}`, Color.cyan));
    });
    const page = await browser.newPage();
    await page.goto(config.host);
    await selectImage(page, file);
    const compress = async (outputType: ImageType) => {
        await setOptions(page, file, outputType);
        await compressImage(page, file, outputType);
        await writeImage(browser, page, file, outputDir);
    };
    let compressed = false;
    const fileType = getFileType(file.path)!;
    for (const customRule of config.customRules) {
        if (customRule.inputType) {
            if (customRule.inputType === fileType) {
                await compress(customRule.outputType);
                compressed = true;
            }
        } else if (!compressed) {
            await compress(customRule.outputType);
        }
    }
    await page.close();
    pageCount -= 1;
}

(async () => {
    const args = [];
    if (config.proxy) {
        args.push(`--proxy-server=${config.proxy}`);
    }
    const browser = await puppeteer.launch({ args });
    const images = [];
    for (const file of getImageFiles(config.inputDir, config.excludeDirs, config.excludeFiles)) {
        images.push(squash(browser, file, config.outputDir));
    }
    await Promise.all(images);
    await browser.close();
})();
