'use strict';

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const _ = require('lodash');
const scraper = require('table-scraper');

const url = 'http://espn.go.com/golf/leaderboard';
const updateFrequencyMins = 10;
const updateFrequencyMillis = updateFrequencyMins * 60 * 1000;

let screen;
let grid;
let s = true;
init();

function init() {
  screen = blessed.screen({ smartCSR: true, log: `${__dirname}/leaderboard.log` });
  grid = new contrib.grid({ rows: 10, cols: 1, screen: screen });

  // quit on esc or ctrl-c.
  screen.key(['escape', 'C-c'], (ch, key) => process.exit(0));
  updateLeaderboard();
  setInterval(updateLeaderboard, updateFrequencyMillis);
}

function updateLeaderboard() {
  scraper.get(url).then((data) => {
    const playerList = data[0]; // assumes the leaderboard is the first <table> on the page
    let filteredPlayerList;
    let table;
    let filterInput;
    const now = new Date();

    // column number/widths just hardcoded for now, issue opened for calculating these more intelligently...
    const colWidths = _.map(_.range(0,11), (el) => 8);
    colWidths[1] = 24 // player column (post-tournament)
    colWidths[2] = 24 // player column (live tournament)

    table = grid.set(1, 0, 9, 1, contrib.table, {
      keys: true,
      vi: true,
      mouse: true,
      fg: 'white', 
      selectedFg: 'black', 
      selectedBg: 'green',
      interactive: true,
      width: '50%',
      height: '100%',
      border: {type: "line", fg: "cyan"},
      columnSpacing: 3, //in chars
      columnWidth: colWidths
    });
    
    table.setLabel({
      text: `Last updated: ${now.getHours()}:${now.getMinutes() < 10 ? 0 : ''}${now.getMinutes()} (updates every ${updateFrequencyMins} minutes)`,
      side: 'right'
    });

    // Text input box to allow users to find specific players
    filterInput = grid.set(0, 0, 1, 1, blessed.textbox, {
      mouse: true,
      padding: { top: 1, left: 3 },
      style: { fg: 'green', focus: { fg: 'green', bg: '#333', } },
      inputOnFocus: true
    });
    filterInput.on('keypress', (key) => {
      // Timeout to allow the I/O event to complete, otherwise filterInput.value may not be up-to-date
      setTimeout(() => refilter(filterInput.getValue()), 0);
    });

    // focus handling
    filterInput.focus();
    table.on('click', () => table.focus());

    refilter('');

    function refilter(filterText) {
      filteredPlayerList = _.filter(playerList, p => { 
        // checking p && p.PLAYER to filter out placeholder rows (e.g. "cut line")
        return !!(
          p && 
          p.PLAYER && 
          p.PLAYER.toUpperCase().indexOf(filterText.toUpperCase()) != -1 
        );
      });

      let tableData = _.map(filteredPlayerList, (p) => {
        delete p.CTRY; // not interested in each player's country...
        // blessed transforms a list of lists into rows, so transform {name: 'abc', place: 8} into ['abc', 8]
        return _.values(p);
      });

      const header = _.keys(filteredPlayerList[0]);
      table.setData({data: tableData, headers: header});
      screen.render();
    }
  });
}
