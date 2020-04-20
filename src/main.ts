import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { Color, ImageType } from './enums';
import { colorize, extnames, getFiles, getSelector, loadConfig, log } from './utils';

const config = loadConfig();
const selector = getSelector();

async function selectImage(page: Page, filepath: string) {
    log(colorize(`Selecting ${filepath}`, Color.cyan));
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector.selectBtn),
    ]);
    await fileChooser.accept([filepath]);
}

async function setOptions(page: Page, filepath: string) {
    log(colorize(`Setting options for ${filepath}`, Color.cyan));
    let selectType = ImageType.jpeg;
    if (config.followType) {
        const type = extnames[path.extname(filepath).substr(1)];
        if (type !== ImageType.jpeg) {
            selectType = type;
            await page.select(selector.typeSelect, type);
        }
    } else if (config.allTo && config.allTo !== ImageType.jpeg) {
        selectType = config.allTo as ImageType;
        await page.select(selector.typeSelect, config.allTo);
    }
    const changeRangeInput = await page.evaluateHandle(() => (selector: string, value: string) => {
        const input = document.querySelector<HTMLInputElement>(selector)!;
        input.value = value;
        (input as any)._retargetEvent(new Event('input'));
    });
    switch (selectType) {
        case ImageType.png:
            if (config.pngEffort && config.pngEffort !== '2') {
                await page.evaluateHandle((changeRangeInput, pngEffortInput, pngEffort) => {
                    changeRangeInput(pngEffortInput, pngEffort);
                }, changeRangeInput, selector.pngEffortInput, config.pngEffort);
            }
            break;
        case ImageType.jpeg:
            if (config.jpegQuality && config.jpegQuality !== '75') {
                await page.evaluateHandle((changeRangeInput, jpegQualityInput, jpegQuality) => {
                    changeRangeInput(jpegQualityInput, jpegQuality);
                }, changeRangeInput, selector.jpegQualityInput, config.jpegQuality);
            }
            break;
        case ImageType.webp:
            if (config.webpEffort && config.webpEffort !== '4') {
                await page.evaluateHandle((changeRangeInput, webpEffortInput, webpEffort) => {
                    changeRangeInput(webpEffortInput, webpEffort);
                }, changeRangeInput, selector.webpEffortInput, config.webpEffort);
            }
            if (config.webpQuality && config.webpQuality !== '75') {
                await page.evaluateHandle((changeRangeInput, webpQualityInput, webpQuality) => {
                    changeRangeInput(webpQualityInput, webpQuality);
                }, changeRangeInput, selector.webpQualityInput, config.webpQuality);
            }
            break;
    }
}

async function compressImage(page: Page, filepath: string) {
    log(colorize(`Compressing ${filepath}`, Color.blue));
    await page.waitForSelector(selector.downloadLink, {
        timeout: 0,
    });
    await page.waitForSelector(selector.loadingSpinner, {
        hidden: true,
        timeout: 0,
    });
}

async function writeImage(page: Page, outputDir: string) {
    const { url, filename, saving } = await page.evaluate((downloadLink, savingSpan) => {
        const a = document.querySelector(downloadLink);
        const span = document.querySelector(savingSpan);
        return {
            url: a.href,
            filename: a.download,
            saving: span ? span.innerText : '',
        };
    }, selector.downloadLink, selector.savingSpan);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, filename);
    let savingMsg = saving && ` (${saving})`;
    if (saving.endsWith('smaller')) {
        savingMsg = colorize(savingMsg, Color.green);
    } else if (saving.endsWith('bigger')) {
        savingMsg = colorize(savingMsg, Color.red);
    }
    log(colorize(`Writing ${outputPath}${savingMsg}`, Color.blue));
    const blob = await page.goto(url);
    // todo: check if exist
    fs.writeFileSync(outputPath, await blob!.buffer());
}

async function squash(browser: Browser, filepath: string, outputDir: string) {
    const page = await browser.newPage();
    await page.goto(config.host);
    await selectImage(page, filepath);
    await setOptions(page, filepath);
    await compressImage(page, filepath);
    await writeImage(page, outputDir);
    await page.close();
}

(async () => {
    const args = [];
    if (config.proxy) {
        args.push(`--proxy-server=${config.proxy}`);
    }
    const browser = await puppeteer.launch({ args });
    const images = [];
    for (const filepath of getFiles(config.inputDir)) {
        images.push(squash(browser, filepath, config.outputDir));
    }
    await Promise.all(images);
    await browser.close();
})();
