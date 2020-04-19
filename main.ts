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
const inputDir = process.env.INPUT_DIR!;
const outputDir = process.env.OUTPUT_DIR!;

for (const variable of [host, inputDir, outputDir]) {
    if (!variable) process.exit(1);
}

const selectBtn = 'file-drop p > button';
const panel = 'file-drop > div > div:last-of-type';
const downloadLink = `${panel} > div:last-of-type > div:last-of-type > a`;
const optionPanel = `${panel} > div:first-of-type`;
const typeSelect = `${optionPanel} > section select`;

enum imageType {
    png = 'png',
    jpeg = 'mozjpeg',
    webp = 'webp',
}

const extDict: { [index: string]: imageType } = {
    png: imageType.png,
    jpg: imageType.jpeg,
    jpeg: imageType.jpeg,
    webp: imageType.webp,
};
const extList = Object.keys(extDict);

async function selectImage(page: Page, filepath: string) {
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
    const { url, filename } = await page.evaluate(downloadLink => {
        const a = document.querySelector(downloadLink);
        return {
            url: a.href,
            filename: a.download,
        };
    }, downloadLink);
    const blob = await page.goto(url);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, filename);
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
    const browser = await puppeteer.launch();
    const images = [];
    for (const filepath of files) {
        images.push(squash(browser, filepath, outputDir));
    }
    await Promise.all(images);
    await browser.close();
})();
