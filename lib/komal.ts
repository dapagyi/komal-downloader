import request from 'request-promise';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import moment from 'moment';
import nodemailer from 'nodemailer';

export default async function(
  // Bejelentkezés
  name: String,
  email: String,
  password: String,
  files: Array<Array<String>>,
  year: Number,
  month: Number,
  message: String,
  emailAddresses: Array<String>,
  status: (msg: string) => void,
) {
  const formData = { name: name, email: email, pwd: password, a: 'login' };

  const j = request.jar();

  let rp = request;
  rp = rp.defaults({ jar: j, resolveWithFullResponse: true });

  let now = moment();

  if (6 <= month && month <= 8) throw Error('Nyáron nincs KöMaL. :)');
  // FIXME:
  // if (
  //   now.isBefore(moment({ y: year.valueOf(), m: month.valueOf() })) ||
  //   (now.month() + 1 == month && now.date() < monthsKomalFirstDay().date())
  // )
  //   throw Error('A kért havi KöMaL még nem jelent meg.');

  // Bejelentkezés
  // if (now.month() + 1 == month && monthsKomalFirstDay().date() <= now.date() && now.date() < 28) {
  if (true) {
    await rp('https://www.komal.hu/u', { method: 'POST', formData: formData })
      .then(res => {
        if (!res.body.includes('A bejelentkezés sikerült')) throw Error('Sikertelen bejelentkezés.');
        status('Sikeres bejelentkezés.');
      })
      .catch(e => {
        throw e;
      });
  }
  // FIXME:
  // console.log(files);
  // // Szükséges tantárgyak kiválasztása
  let sites = { mat: ['A', 'B', 'C', 'K'], fiz: ['G', 'M', 'P'], inf: ['I', 'I/S', 'S'] };
  // let downloadSites: Array<String> = [];
  // let all = files.map(file => file.join(' ')).join(' ');
  // for (let s of Object.keys(sites)) {
  //   if (!all.includes(s) && RegExp('( ' + sites[s].join(' | ') + ' )').test(all)) {
  //     downloadSites.push(s);
  //   }
  // }
  // console.log(downloadSites);
  let downloadSites = ['mat', 'fiz', 'inf'];
  if (downloadSites.length == 0) throw Error('Hibás fájlkérés.');
  let contests = {};

  const tempDir = path.join(__dirname, '..', 'temp');

  // Create the log directory if it does not exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // Régi design
  await rp('https://www.komal.hu/u?a=skin1&ok=1')
    .then(() => {
      // Feladatok
      let promises: Array<Promise<request.RequestPromise>> = [];
      downloadSites.forEach((site, index) => {
        let c = sites[downloadSites[index].toString()];
        // console.log(site, c);
        promises.push(
          new Promise(async resolve => {
            let page = await rp(
              `https://www.komal.hu/feladat?a=honap&h=${year}${String(month).padStart(2, '0')}&t=${site}&l=hu`,
            );

            const imgRgx = /src="\//gi;
            const linkRgx = /href="\//gi;
            const statRgx = /<p align="right"><[\s\S]{1,120}<\/a><\/p>/g;
            const solutionRgx = /<blockquote><p align="left">[\s\S]{1,450}<\/p><\/blockquote>/g;
            page.body = page.body
              .replace(imgRgx, 'src="https://www.komal.hu/')
              .replace(linkRgx, 'href="https://www.komal.hu/')
              .replace(statRgx, '')
              .replace(solutionRgx, '');
            const $ = cheerio.load(page.body);
            $('hr').remove();

            for (let s in c) {
              let html = $.html(`#div_${c[s].split('/').join('\\/')}`);
              contests[c[s]] = html;
            }

            resolve(page);
          }),
        );
      });

      return Promise.all(promises);
    })
    .catch(e => {
      throw e;
    });

  const $ = cheerio.load(fs.readFileSync(path.join(__dirname, '..', 'assets', 'sample.html')));
  $('#greeting').html(message.toString());

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  await Promise.all(
    files.map(file => {
      return new Promise(async resolve => {
        // console.log(file);
        const file$ = cheerio.load($.html());
        file$('#contests').html(
          file
            .map(c => {
              return contests[c.toString()];
            })
            .join(''),
        );

        const fileName = file
          .join('')
          .split('/')
          .join('p');
        // const filePath = path.join(__dirname, '..', 'temp', fileName + '.html');
        // fs.writeFileSync(filePath, file$.html(), { flag: 'w' });

        const page = await browser.newPage();
        await page.setContent(file$.html());
        // await page.goto(`file:${filePath}`);
        await page.waitFor(3000);
        await page.pdf({
          path: `temp/${year + month.toString().padStart(2, '0') + fileName}.pdf`,
          format: 'A4',
          margin: {
            top: '1cm',
            left: '1cm',
            right: '1cm',
            bottom: '1cm',
          },
        });
        await page.close();
        // fs.unlinkSync(filePath);
        resolve();
      });
    }),
  );

  await browser.close();

  var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USERNAME,
      pass: process.env.GMAIL_PASSWORD,
    },
  });

  let info = await transporter.sendMail({
    from: '"KöMaL" <apagyi.david@gmail.com>',
    to: '',
    bcc: emailAddresses.join(', '),
    subject: `${year}. ${moment({ month: month.valueOf() - 1 })
      .locale('hu')
      .format('MMMM')
      .toLowerCase()}i KöMaL feladatok`,
    text: '',
    html: `Szia!<br><br>Az alábbiakban csatolom a kért pontversenyek feladatait.<br><br>Minden jót,<br>Dávid`,
    attachments: files.map(file => {
      const fileName =
        year +
        month.toString().padStart(2, '0') +
        file
          .join('')
          .split('/')
          .join('p') +
        '.pdf';
      const filePath = path.join(__dirname, '..', 'temp', fileName);
      return {
        filename: fileName,
        path: filePath,
      };
    }),
  });
  console.log('Message sent: %s', info.messageId);

  await transporter.sendMail({
    to: 'apagyi.david@gmail.com',
    subject: 'KöMaL letöltő használva',
    html: `${name} a következők letöltésére használta a programot: ${files
      .map(file => {
        return (
          year +
          month.toString().padStart(2, '0') +
          file
            .join('')
            .split('/')
            .join('p') +
          '.pdf'
        );
      })
      .join(', ')}.<br>A következő cím${emailAddresses.length > 1 ? 'ek' : ''}re lett elküldve: ${emailAddresses.join(
      ', ',
    )}`,
  });

  await Promise.all(
    files.map(file => {
      return new Promise(resolve => {
        const fileName =
          year +
          month.toString().padStart(2, '0') +
          file
            .join('')
            .split('/')
            .join('p') +
          '.pdf';
        const filePath = path.join(__dirname, '..', 'temp', fileName);
        fs.unlinkSync(filePath);
        resolve();
      });
    }),
  );

  // console.log('Lib end');
}

// /**
//  * Aktuális hónapban megjelent / megjelenő KöMaL első napja
//  * @param d
//  */
function monthsKomalFirstDay() {
  let d = moment();
  let lastDay = moment({ year: d.year(), month: d.month(), day: 10 });
  if (lastDay.day() == 0 || lastDay.day() == 6) lastDay.day(1);
  let firstDay = lastDay.add({ d: 1 });
  // console.log(firstDay.format('YYYY MM DD'));
  return firstDay;
}

// export function isAuthNeeded(m = moment()) {
//   m = moment('2019-10-27');
//   return m.isBefore(monthsKomalFirstDay()) && m.date() < 28;
// }

// function test(body, name) {
//   console.log('---------------');
//   console.log('név: ' + body.includes(name));
//   console.log('skin: ' + body.includes('új honlap'));
//   console.log('feladat: ' + body.includes('élhalmaznak'));
// }
