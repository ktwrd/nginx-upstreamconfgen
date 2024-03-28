const fs = require('fs');
const path = require('path');
const childProcess = require('node:child_process');

/*
   Copyright 2024 Kate Ward <kate@dariox.club>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

const argvSliced = process.argv.slice(2);
if (argvSliced == '--help') {
    console.log([
        'NGINX Upstream Config Generator',
        '    --help                show this message',
        '    [config location]     location for the config. default is "./config.json"',
        '',
        'when no arguements are provided, it will assume that you want to run with',
        'the config at the location "./config.json"'
    ].join('\n'))
    process.exit(0);
}

/**
 * @typedef {Object} ConfigData
 * @property {string} outputLocation - Location that the config should be written to.
 * @property {ConfigDataItem[]} items - Items to include in the config.
 */
/**
 * @typedef {Object} ConfigDataItem
 * @property {string} containerName - Name of the docker contianer.
 * @property {string} upstreamName - What should the name be for the upstream connection.
 * @property {number} port - What port should be used?
 * @property {string} [extra] - Extra stuff that is added after the `server ip:port` line.
 */

var configLocation = 'config.json';
var providedConfigLocation = argvSliced.join(' ').trim();
if (providedConfigLocation.length > 0)
{
    console.log('using config location provided');
    configLocation = providedConfigLocation;
}

if (!fs.existsSync(configLocation))
{
    console.error(configLocation + ' doesn\'t exist.\n'+
    'please look at the typedef in the code and make a config based off that xoxo');
    process.exit(1);
}

/** @type {ConfigData} */
const config = JSON.parse(fs.readFileSync(configLocation).toString());

function isString(item) {
    return item != undefined && item != null && typeof item == 'string' && item.length > 0;
}
function isArray(item) {
    return item != undefined && item != null && Array.isArray(item);
}
function isNumber(item) {
    return item != undefined && item != null && typeof item == 'number' && item > 0;
}

if (!isString(config.outputLocation)) {
    console.error('config.outputLocation is not set or it\'s not a string.');
    process.exit(1);
}
if (!isArray(config.items) || config.items.length < 1) {
    console.error('no items provided in config.items');
    process.exit(1);
}
for (let i in config.items) 
{
    var item = config.items[i];
    if (!isString(item.containerName)) {
        console.error(`config.items[${i}].containerName is not a string`);
        process.exit(1);
    }
    if (!isString(item.upstreamName)) {
        console.error(`config.items[${i}].upstreamName is not a string`);
    }
    if (!isNumber(item.port)) {
        console.error(`config.items[${i}].port is not a number`);
    }
}



if (!fs.existsSync(config.outputLocation))
{
    var dn = path.dirname(config.outputLocation);
    if (!fs.existsSync(dn)) {
        fs.mkdirSync(dn);
    }
}

/**
 * @typedef {Object} SpawnAsyncResult
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} code - Exit code
 */
/**
 * @description
 * Async implementation of the `spawn` function.
 * @param {string} command 
 * @param {string[]} args 
 * @returns SpawnAsyncResult
 */
async function spawnAsync(command, args) {
    return new Promise((resolve, reject) =>
    {
        var f = childProcess.spawn(command, args);
        var res = {
            stdout: '',
            stderr: '',
            code: -1
        }
        f.stdout.on('data', (data) =>
        {
            res.stdout += data.toString()
        });
        f.stderr.on('data', (data) =>
        {
            res.stderr += data.toString()
        });

        f.on('close', (code) =>
        {
            res.code = code;
            resolve(res);
        });
    });
}

(async () =>
{
    var outputContent = '';
    for (let i in config.items)
    {
        var item = config.items[i];
        var data = await spawnAsync('docker', ['inspect', item.containerName]);
        if (data.code != 0)
        {
            console.error(`failed to run task for config.items[${i}]`);
            console.error(data.stderr);
            process.exit(data.code);
            return;
        }
        var parsed = JSON.parse(data.stdout);
        if (parsed.length < 1)
        {
            console.error('no items in result');
            process.exit(1);
            return;
        }

        var dockerItem = parsed[0];
        var innerLines = '';

        var extra = '';
        if (item.extra != null && item.extra != undefined && typeof item.extra == 'string') {
            extra = ` ${item.extra}`;
        }

        for (let networkPair of Object.entries(dockerItem.NetworkSettings.Networks))
        {
            var addr = networkPair[1].IPAddress;
            if (networkPair[0] == 'host') {
                addr = 'localhost';
            }
            innerLines += `    server ${addr}:${item.port}${extra}; // ${networkPair[0]}\n`;
            console.log(`${item.containerName.padEnd(30)} -> ${addr}:${item.port} (${item.upstreamName})`);
        }
        innerLines = `upstream ${item.upstreamName} {\n${innerLines}}`;
        outputContent += innerLines + '\n\n';
    }

    fs.writeFileSync(config.outputLocation, outputContent);
    console.log('wrote config to ' + config.outputLocation);
})();
