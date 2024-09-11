/**
 *
 * otgw adapter
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

// @ts-ignore
const utils = require('@iobroker/adapter-core');
const otgw = require('./lib/otg_api');
let otgwapi;
//const adapter = new utils.Adapter('otgw');
let adapter;
const adapterName = require('./package.json').name.split('.').pop();
const controlStates = [
    {
        id: 'command',
        name: 'Send command to OTGW',
        icon: undefined,
        role: 'command',
        write: true,
        read: false,
        type: 'string',
    },
    {
        id: 'command_response',
        name: 'Response on command from OTGW',
        icon: undefined,
        role: 'command',
        write: false,
        read: true,
        type: 'string',
    },
];

function startAdapter(options) {

    options = options || {};
    Object.assign(options, { name: adapterName });

    adapter = new utils.Adapter(options);
    adapter.on('unload', function (callback) {
        try {
            adapter.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    });


    adapter.on('ready', function () {
        main();
    });

    adapter.on('stateChange', function (id, state) {
        // you can use the ack flag to detect if it is status (true) or command (false)
        if (state && !state.ack) {
            adapter.log.debug('User stateChange ' + id + ' ' + JSON.stringify(state));
            const stateKey = id.split('.')[2];
            switch (stateKey) {
                case 'command':
                    otgwapi.sendCommand(state.val)
                        .then((resp) => {
                            if (resp == true) {
                                adapter.setState(id + '_response', 'OK', true);
                            }
                            adapter.log.debug('Command response:' + JSON.stringify(resp));
                        })
                        .catch((err) => {
                            adapter.log.debug('Command error:' + JSON.stringify(err));
                            adapter.setState(id + '_response', JSON.stringify(err), true);
                        });
                    break;
            }
        }
    });

    adapter.on('unload', (callback) => {

        try {
            adapter.log.info('cleaned everything up...');
            callback();
        } catch (err) {
            // @ts-ignore
            callback(err);
        }
    });
}

function debugToAdapter(data) {
    adapter.log.debug(data.msg);
}

function onConnect(data) {
    adapter.log.debug('Result of connect', data);
    //if (data.found) {
    if (data) {
        adapter.log.debug(`Connected to ${data.ip}:${data.port} verison ${data.version}`);
        adapter.setState('info.connection', true);
        recreateStates();
    } else {
        otgwapi.closePort();
        otgwapi = undefined;
        adapter.setState('info.connection', false);
        adapter.log.error(`Can not connect to gateway`);
    }
}

function onUpdate(name, value) {
    const common = {
        type: typeof (value),
    };
    updateState(name, value, common);
}

function recreateStates() {
    controlStates.forEach((statedesc) => {
        const common = {
            name: statedesc.name,
            type: statedesc.type,
            unit: statedesc.unit,
            read: statedesc.read,
            write: statedesc.write,
            icon: statedesc.icon,
            role: statedesc.role,
            min: statedesc.min,
            max: statedesc.max,
        };
        updateState(statedesc.id, undefined, common);
    });
}

function updateState(name, value, common) {
    let new_common = { name: name };
    let id = name;
    if (common != undefined) {
        if (common.name != undefined) {
            new_common.name = common.name;
        }
        if (common.type != undefined) {
            new_common.type = common.type;
        }
        if (common.unit != undefined) {
            new_common.unit = common.unit;
        }
        if (common.states != undefined) {
            new_common.states = common.states;
        }
        if (common.read != undefined) {
            new_common.read = common.read;
        }
        if (common.write != undefined) {
            new_common.write = common.write;
        }
        if (common.role != undefined) {
            new_common.role = common.role;
        }
        if (common.min != undefined) {
            new_common.min = common.min;
        }
        if (common.max != undefined) {
            new_common.max = common.max;
        }
        if (common.icon != undefined) {
            new_common.icon = common.icon;
        }
    }
    // check if state exist
    adapter.getObject(id, function (err, stobj) {
        if (stobj) {
            // update state - not change name and role (user can it changed)
            delete new_common.name;
            delete new_common.role;
        }
        try {
            adapter.extendObject(id, { type: 'state', common: new_common });
        } catch (e) {
            adapter.log.warn(e);
        }
        try {
            if (value != undefined) {
                adapter.setState(id, value, true);
            }
        } catch (e) {
            adapter.log.warn(e);
        }
    });
}

function main() {
    adapter.subscribeStates('*');
    const host = adapter.config.host;
    const port = adapter.config.port;
    if (host && port) {
        adapter.log.info(`Start conncet to ${host}:${port}`);
        otgwapi = new otgw();
        otgwapi.setDebug(3); // APP & API
        otgwapi.on('debug', debugToAdapter);
        otgwapi.on('found', onConnect);
        otgwapi.on('update', onUpdate);
        otgwapi.openPort(host, Number(port));
    } else {
        adapter.log.error('Empty host or port. Please configure adapter first.');
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    module.exports = startAdapter;
} else {
    startAdapter();
}