import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as walk from 'walk';

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

const selectBtn = 'file-drop p > button';
const panel = 'file-drop > div > div:last-of-type';
const downloadLink = `${panel} > div:last-of-type > div:last-of-type > a`;
const savingSpan = `${panel} > div:last-of-type > div:first-of-type > span > span`;
const optionPanel = `${panel} > div:first-of-type`;
const typeSelect = `${optionPanel} > section select`;

enum imageType {
    png = 'png',
    jpeg = 'mozjpeg',
    webp = 'webp',
}

enum color {
    red = 31,
    green = 32,
    blue = 34,
    cyan = 36
}

const extDict: { [index: string]: imageType } = {
    png: imageType.png,
    jpg: imageType.jpeg,
    jpeg: imageType.jpeg,
    webp: imageType.webp,
};
const extList = Object.keys(extDict);

function colorize(msg: string, color: number) {
    return `\x1B[${color}m${msg}\x1B[0m`;
}

async function selectImage(page: Page, filepath: string) {
    console.log(colorize(`Compressing ${filepath}`, color.cyan));
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selectBtn),
    ]);
    await fileChooser.accept([filepath]);
}

async function setOptions(page: Page, extname: string) {
    await page.select(typeSelect, extDict[extname]);
}

async function writeImage(page: Page, outputDir: string) {
    await page.waitForSelector(downloadLink, {
        timeout: 0,
    });
    const { url, filename, saving } = await page.evaluate((downloadLink, savingSpan) => {
        const a = document.querySelector(downloadLink);
        const span = document.querySelector(savingSpan);
        return {
            url: a.href,
            filename: a.download,
            saving: span ? span.innerText : '',
        };
    }, downloadLink, savingSpan);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, filename);
    let savingMsg = saving && ` (${saving})`;
    if (saving.endsWith('smaller')) {
        savingMsg = colorize(savingMsg, color.green);
    } else if (saving.endsWith('bigger')) {
        savingMsg = colorize(savingMsg, color.red);
    }
    console.log(colorize(`Writing ${outputPath}${savingMsg}`, color.blue));
    const blob = await page.goto(url);
    // todo: check if exist
    fs.writeFileSync(outputPath, await blob!.buffer());
}

async function squash(browser: Browser, filepath: string, outputDir: string) {
    const page = await browser.newPage();
    await page.goto(host);
    await selectImage(page, filepath);
    await setOptions(page, path.extname(filepath).substr(1));
    await writeImage(page, outputDir);
    await page.close();
}

(async () => {
    const files: string[] = [];
    walk.walkSync(inputDir, {
        listeners: {
            file: (root, fileStats, next) => {
                const filename = fileStats.name;
                const extname = path.extname(filename).substr(1);
                if (extList.includes(extname)) {
                    files.push(path.join(root, filename));
                }
                next();
            },
        },
    });
    const args = [];
    if (proxy) {
        args.push(`--proxy-server=${proxy}`);
    }
    const browser = await puppeteer.launch({ args });
    const images = [];
    for (const filepath of files) {
        images.push(squash(browser, filepath, outputDir));
    }
    await Promise.all(images);
    await browser.close();
})();