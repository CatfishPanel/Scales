/**
 * Scales.js — the flexible game management daemon built for PufferPanel.
 * Licensed under a GPL-v3 license.
 *
 * main.js — Adds PocketMine-MP Server support to Scales.js
 */
require('date-utils');
var Fs = require('fs-extra');
var Rfr = require('rfr');
var Path = require('path');
var Logger = Rfr('lib/logger.js');
var Properties = require('properties-parser');
var Util = require('util');
var Core = Rfr('lib/plugins/core/main.js');

/**
 * Establishes the plguin function and makes constants avaliable across the entire function.
 * @param {object} preflight new Preflight();
 */
var Plugin = function (root, public, config) {

    this.serverConfig = config;
    this.rootPath = root;
    this.publicPath = public;
    this.settings = Rfr('lib/plugins/pocketmine/config.json');
    this.query = {};

    this.CorePlugin = new Core(this);
};

/**
 * Queries the specified server using Gamedig and returns the information in a standard format.
 * @return {bool}
 */
Plugin.prototype.queryServer = function (next) {

    var self = this;
    this.CorePlugin.query(function (err, query) {

        if (err) {
            Logger.error(err.stack);
            return next(err);
        }

        self.query = query;
        return next();

    });

};

/**
 * Runs the plugin PreFlight before attempting to start the server.
 * Checks for basic mistakes in configuration or other issues with the files.
 * @param {callback}
 * @return {callback} Returns results in a callback next()
 */
Plugin.prototype.preflight = function (next) {

    var self = this;
    propertiesPath = Path.join(this.publicPath, this.settings.cfg);

    Fs.stat(propertiesPath, function (err, stats) {

        if (err) {
            if (err.code === 'ENOENT') {
                return next(null, 1);
            }
            return next(err);
        }

        if (stats.isFile()) {

            Properties.createEditor(propertiesPath, function (err, editor) {

                if (err) {
                    Logger.error('An error occured while attempting to read the server.properties file for ' + this.serverConfig.name, err);
                    return next('An error occured while attempting to read the server.properties file.');
                }

                editor.set('enable-query', 'on');
                editor.set('server-port', self.serverConfig.gameport.toString());
                editor.set('memory-limit', self.serverConfig.build.memory.toString() + 'M');

                editor.save(propertiesPath, function (err) {

                    if (err) {
                        Logger.error('An error occured trying to update the ' + self.settings.cfg + ' file for ' + self.serverConfig.name, err);
                        return next(new Error('An error occured trying to update the ' + self.settings.cfg + ' file'));
                    }

                    Logger.verbose('Completed plugin preflight for ' + self.serverConfig.name);
                    return next();

                });

            });

        } else {
            return next(new Error('The properties file (' + propertiesPath + ') is not a valid file.'));
        }

    });

};

Plugin.prototype.startup = function () {

    if (!this.CorePlugin.stringEndsWith(this.serverConfig.startup.command, '--disable-ansi --no-wizard')) {
        this.serverConfig.startup.command = this.serverConfig.startup.command + ' --disable-ansi --no-wizard';
    }

    var startupArray = Util.format('exec -it %s %s ', this.serverConfig.user, this.settings.exe) + this.serverConfig.startup.command
            .replace('${ip}', this.serverConfig.gamehost)
            .replace('${port}', this.serverConfig.gameport)
            .replace('${memory}', this.serverConfig.build.memory);

    for (var index in this.serverConfig.startup.variables) {
        startupArray = startupArray.replace('${' + index + '}', this.serverConfig.startup.variables[index]);
    }

    return startupArray.match(/\S+/g);

};

module.exports = Plugin;
