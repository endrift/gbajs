GBA.js
======
**Version 1.1-git — Copyright © 2012 – 2013 Jeffrey Pfau**

GBA.js is a Game Boy Advance emulator written from scratch to employ HTML5 technologies like Canvas and Web Audio. It uses no plugins, and is designed to run on cutting edge web browsers. It is hosted [on GitHub](https://github.com/endrift/gbajs) and is made available under the 2-clause BSD license. The most recent version can be found at [http://endrift.github.io/gbajs/](http://endrift.github.io/gbajs/).

## Browser Compatibility
The current version of GBA.js is known to work in the following web browsers:

* Safari 6.0 or newer
* Chrome 22 or newer
* Firefox 25 or newer (slow)

The following web browsers also work, but will have degraded feature sets:

* Firefox 15 or newer (no sound, slow)
* Opera 12.1x or newer (no sound, slow)
* Internet Explorer 10 or newer (no sound, slow, pixelated display does not work)
* Chrome 20, 21 (pixelated display does not work)

The following browsers will not work:

* Safari 5.1.x or older (no File API for uploading games into JavaScript)
* Firefox 14 or older (no DataView, used for memory)
* Internet Explorer 9 or older

All other browsers are untested.

## Game Compatibility
Please see the [compatibility list on the GitHub wiki](https://github.com/endrift/gbajs/wiki/Compatibility-List) for a list of tested games. Note that GBA.js is tuned for commercial games, and is currently lacking good support for homebrew games.

## Feature List
Currently, every part of the Game Boy Advance hardware, save for some lesser used features and the link cable are implemented.

The emulator also has these features:

* Downloadable and uploadable savegames
* Screenshots
* Pausing the emulation
* Support for gamepaks that contain a realtime clock (e.g. Pokemon Ruby and Sapphire)

Features that may be implemented in the future include:

* Savestates
* Remappable controls
* Gamepad support
* Link cable over Web Sockets
* Cheat code support
* Fullscreen support
* Support for gamepaks that have other sensors (e.g. WarioWare Twisted!, Boktai)

## License
Copyright © 2012 – 2013, Jeffrey Pfau
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
