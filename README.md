NoFlo Signal K plugin
=====================

This plugin can be used for creating various automations in your [Signal K](http://signalk.org) environment using the [NoFlo](https://noflojs.org) flow-based programming framework.

A similar setup also [exists for Node Red](https://github.com/SignalK/signalk-node-red).

This package supplies a set of NoFlo components for interacting with the [Signal K Server API](https://github.com/SignalK/signalk-server/blob/master/SERVERPLUGINS.md#server-api-for-plugins). For other logic you can either [write your own components](https://noflojs.org/documentation/components/) or install any of the dozens of [NoFlo component libraries](https://www.npmjs.com/search?q=keywords:noflo) available.

Status: early stages

## Changes

* 0.2.0 (2023-01-12)
  - Fixed main graph detection
  - Now using the community version of NoFlo UI
