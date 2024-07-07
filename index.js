
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
const cp = require('child_process');
const fs = require('fs');
function is_file(file) {
    try {
        fs.accessSync(file, fs.F_OK);
        return true;
    } catch (err) {
        return false;
    }
}
function sanitizeFilename(filename) {
    // Windows filename restrictions:
    // Reserved characters: < > : " / \ | ? *
    // Reserved names: CON, PRN, AUX, NUL, COM1, COM2, COM3, COM4, COM5, COM6, COM7, COM8, COM9, LPT1, LPT2, LPT3, LPT4, LPT5, LPT6, LPT7, LPT8, LPT9
    // Also, filenames cannot end with a space or a period.

    const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    const sanitized = filename
        .replace(/[<>:"/\\|?*]+/g, '')  // Remove reserved characters
        .replace(/\.\s*$/, '')          // Remove trailing period
        .replace(/\s+$/, '');           // Remove trailing spaces

    // Check if the name is a reserved name after removing the invalid characters
    if (reservedNames.test(sanitized)) {
        return `${sanitized}_safe`; // Append something to make it safe
    }

    return sanitized;
}
var index_of_m3u8 = 1, pbrowser = null, page = null, got = false;
const start = async () => {
    pbrowser = await puppeteer.launch({ headless: true, timeout: 0 });
    page = await pbrowser.newPage();
    await page.setRequestInterception(true);
    let i = 0;
    page.on('request', async interceptedRequest => {
        if (interceptedRequest.url().includes('m3u8')) {
            i++;
            if (i == index_of_m3u8) {
                await pbrowser.close();
                console.log('got the m3u8 request!');
                got = true;
                headers = '';
                for (let key in interceptedRequest.headers()) {
                    headers += key + ': ' + interceptedRequest.headers()[key] + '\r\n';
                }
                var ffmpeg = 'ffmpeg';
                if (is_file('./ffmpeg.exe')) {
                    ffmpeg = './ffmpeg.exe';
                }
                const p = cp.spawn(ffmpeg, ['-loglevel', 'error', '-stats', '-protocol_whitelist', 'file,crypto,data,https,http,tls,tcp', '-headers', headers, '-i', interceptedRequest.url(), '-c:v', 'copy', '-c:a', 'copy', output_file, '-y'], { stdio: 'inherit' });
                p.on('exit', (code) => {
                    if (code !== 0) {
                        console.log('ffmpeg exited with code ' + code);
                        console.log('failed to download video');
                        process.exit(1);
                    } else {
                        console.log('ffmpeg exited with code ' + code);
                        console.log('successfully downloaded video to ' + output_file);
                        process.exit(0);
                    }
                });
            }
        }
        interceptedRequest.continue();
    });
}
const binged_in = async () => {
    if (url.includes("/info")) {
        console.log('info url detected, replacing with streaming url...');
        url = url.replace('/info', '/watch');
    }
    const go = async () => {
        await page.goto(url);
        setTimeout(async () => {
            if (!got) {
                console.log('timeout reached, retrying...');
                go();
            }
        }, 3000);
    }
    go();
}
const embtaku_pro = async () => {
    await page.goto(url);
    await page.evaluateOnNewDocument(() => {
        window.open = (url) => {
            console.log(`Blocked attempt to open new window: ${url}`);
            return null;
        };
    });
    if (!url.includes('/streaming.php')) {
        console.log('attempting to get the streaming url...');
        const element = await page.$('iframe');
        url = await page.evaluate((element) => element.src, element);
        console.log('got the streaming url: ' + url);
        await page.goto(url);
        await page.evaluateOnNewDocument(() => {
            window.open = (url) => {
                console.log(`Blocked attempt to open new window: ${url}`);
                return null;
            };
        });
    }
    await page.waitForSelector('div[aria-label="Play"]');
    const element = await page.$('div[aria-label="Play"]');
    const click = async () => { // try multiple times to click on the element because we will trigger popups
        try {
            await page.bringToFront();
            const boundingBox = await element.boundingBox();
            await page.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            await page.mouse.down();
            await page.mouse.up();
        } catch (e) { }
        setTimeout(async () => {
            if (!got) click();
        }, 500);
    }
    click();
}
var output_file = process.argv[3];
var url = process.argv[2];
if (!url) {
    console.log('usage: node index.js <url> [<output_file>]');
    process.exit(1);
}
if (!output_file) {
    output_file = sanitizeFilename(url.replace('https://', '').replace('http://', '').replace(/\//g, '_')) + '.mp4';
}
switch ((new URL(url)).host) {
    case 'embtaku.pro':
        start().then(() => {
            index_of_m3u8 = 1;
            embtaku_pro();
        });
        break;
    case 'binged.in':
        start().then(() => {
            index_of_m3u8 = 2;
            binged_in();
        });
        break;
    default:
        console.log('domain not supported ' + (new URL(url)).host);
        console.log('supported domains: embtaku.pro, binged.in');
        process.exit(1);
}