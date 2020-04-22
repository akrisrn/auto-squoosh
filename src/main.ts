import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { Color, ImageType, ResizePreset } from './enums';
import { colorize, extnames, getImageFiles, getSelector, loadConfig, log, sleep } from './utils';
import * as AsyncLock from 'async-lock';

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

async function setOptions(page: Page, file: ImageFile) {
    log(colorize(`Setting options for ${file.path}`, Color.cyan));
    let selectType = ImageType.jpeg;
    if (config.followType) {
        const type = extnames[path.extname(file.path).substr(1)];
        if (type !== ImageType.jpeg) {
            selectType = type;
            await page.select(selector.typeSelect, type);
        }
    } else if (config.allTo !== ImageType.jpeg) {
        selectType = config.allTo as ImageType;
        await page.select(selector.typeSelect, config.allTo);
    }
    const changeInput = await page.evaluateHandle(() => (inputSelector: string, value: string) => {
        const input = document.querySelector<HTMLInputElement>(inputSelector)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
    });
    switch (selectType) {
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
    if (config.resizeWidth) {
        if (config.resizeWidth !== file.width.toString()) {
            await page.click(selector.resizeLabel);
            const isChanged = await page.evaluate((resizeWidthInput, resizeWidth, scaleUp) => {
                const input = document.querySelector<HTMLInputElement>(resizeWidthInput)!;
                if (scaleUp || parseInt(input.value, 10) > parseInt(resizeWidth, 10)) {
                    input.value = resizeWidth;
                    input.dispatchEvent(new Event('input'));
                    return true;
                }
                return false;
            }, selector.resizeWidthInput, config.resizeWidth, config.scaleUp);
            if (!isChanged) {
                await page.click(selector.resizeLabel);
            }
        }
    } else if (config.resizePreset !== ResizePreset['100%']) {
        await page.click(selector.resizeLabel);
        await page.select(selector.resizePresetSelect, config.resizePreset);
    }
}

async function compressImage(page: Page, file: ImageFile) {
    log(colorize(`Compressing ${file.path}`, Color.blue));
    await page.waitForSelector(selector.downloadLink, {
        timeout: 0,
    });
    await page.waitForSelector(selector.loadingSpinner, {
        hidden: true,
        timeout: 0,
    });
}

async function writeImage(page: Page, file: ImageFile, outputDir: string) {
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
    if (config.followPath) {
        outputDir = path.join(outputDir, path.dirname(file.path).substr(path.join(config.inputDir).length));
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {
            recursive: true,
        });
    }
    let outputPath = path.join(outputDir, filename);
    if (fs.existsSync(outputPath)) {
        if (config.overwrite) {
            if (saving.startsWith('slightly') && config.abortSlight || saving.endsWith('bigger') && config.abortBigger) {
                log(colorize(`Abort write ${outputPath} (${size} ${saving})`, Color.red));
                return;
            }
        } else {
            const extname = path.extname(outputPath);
            const pathNoExt = outputPath.substr(0, outputPath.length - extname.length);
            let index = 1;
            do {
                outputPath = `${pathNoExt} (${index})${extname}`;
                index += 1;
            } while (fs.existsSync(outputPath));
        }
    }
    let savingMsg = `(${size} ${saving})`;
    if (saving.endsWith('smaller')) {
        savingMsg = colorize(savingMsg, Color.green);
    } else {
        savingMsg = colorize(savingMsg, Color.red);
    }
    log(colorize(`Writing ${outputPath} ${savingMsg}`, Color.blue));
    const blob = await page.goto(url);
    fs.writeFileSync(outputPath, await blob!.buffer());
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
    await setOptions(page, file);
    await compressImage(page, file);
    await writeImage(page, file, outputDir);
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
    for (const file of getImageFiles(config.inputDir, config.excludeDirs)) {
        images.push(squash(browser, file, config.outputDir));
    }
    await Promise.all(images);
    await browser.close();
})();
