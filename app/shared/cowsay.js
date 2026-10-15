// Tiny dependency-free cowsay. Loaded by Node (functions) and by the browser (/cowsay.js).
// Generated art table; edit the renderer below freely.
(function (root) {
  "use strict";

  // Blob names look like "<cow> -_- <message> -_- #<id>", e.g. "cow -_- helloworld -_- #3f9a1c".
  // The random id suffix lets the same message be posted more than once without overwriting.
  const DELIM = " -_- ";
  const ID_SUFFIX = /\s-_-\s#[0-9a-f]{6}$/;
  const WIDTH = 30;

  const COWS = {
    cow: { emoji: "🐄", art: "        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||" },
    tux: { emoji: "🐧", art: "   \\\n    \\\n        .--.\n       |o_o |\n       |:_/ |\n      //   \\ \\\n     (|     | )\n    /'\\_   _/`\\\n    \\___)=(___/" },
    dragon: { emoji: "🐉", art: "      \\                    / \\  //\\\n       \\    |\\___/|      /   \\//  \\\\\n            /0  0  \\__  /    //  | \\ \\\n           /     /  \\/_/    //   |  \\  \\\n           @_^_@'/   \\/_   //    |   \\   \\\n           //_^_/     \\/_ //     |    \\    \\\n        ( //) |        \\///      |     \\     \\\n      ( / /) _|_ /   )  //       |      \\     _\\\n    ( // /) '/,_ _ _/  ( ; -.    |    _ _\\.-~        .-~~~^-.\n  (( / / )) ,-{        _      `-.|.-~-.           .~         `.\n (( // / ))  '/\\      /                 ~-. _ .-~      .-~^-.  \\\n (( /// ))      `.   {            }                   /      \\  \\\n  (( / ))     .----~-.\\        \\-'                 .~         \\  `. \\^-.\n             ///.----..>        \\             _ -~             `.  ^-`  ^-_\n               ///-._ _ _ _ _ _ _}^ - - - - ~                     ~-- ,.-~\n                                                                  /.-~" },
    stegosaurus: { emoji: "🦕", art: "\\                             .       .\n \\                           / `.   .' \"\n  \\                  .---.  <    > <    >  .---.\n   \\                 |    \\  \\ - ~ ~ - /  /    |\n         _____          ..-~             ~-..-~\n        |     |   \\~~~\\.'                    `./~~~/\n       ---------   \\__/                        \\__/\n      .'  O    \\     /               /       \\  \"\n     (_____,    `._.'               |         }  \\/~~~/\n      `----.          /       }     |        /    \\__/\n            `-.      |       /      |       /      `. ,~~|\n                ~-.__|      /_ - ~ ^|      /- _      `..-'\n                     |     /        |     /     ~-.     `-. _  _  _\n                     |_____|        |_____|         ~ - . _ _ _ _ _>" },
    vader: { emoji: "🌑", art: "        \\    ,-^-.\n         \\   !oYo!\n          \\ /./=\\.\\______\n               ##        )\\/\\\n                ||-----w||\n                ||      ||\n\n               Cowth Vader" },
    moose: { emoji: "🫎", art: "  \\\n   \\   \\_\\_    _/_/\n    \\      \\__/\n           (oo)\\_______\n           (__)\\       )\\/\\\n               ||----w |\n               ||     ||" },
    sheep: { emoji: "🐑", art: "  \\\n   \\\n       __\n      UooU\\.'@@@@@@`.\n      \\__/(@@@@@@@@@@)\n           (@@@@@@@@)\n           `YY~~~~YY'\n            ||    ||" },
    turtle: { emoji: "🐢", art: "    \\                                  ___-------___\n     \\                             _-~~             ~~-_\n      \\                         _-~                    /~-_\n             /^\\__/^\\         /~  \\                   /    \\\n           /|  O|| O|        /      \\_______________/        \\\n          | |___||__|      /       /                \\          \\\n          |          \\    /      /                    \\          \\\n          |   (_______) /______/                        \\_________ \\\n          |         / /         \\                      /            \\\n           \\         \\^\\\\         \\                  /               \\     /\n             \\         ||           \\______________/      _-_       //\\__//\n               \\       ||------_-~~-_ ------------- \\ --/~   ~\\    || __/\n                 ~-----||====/~     |==================|       |/~~~~~\n                  (_(__/  ./     /                    \\_\\      \\.\n                         (_(___/                         \\_____)_)" },
    daemon: { emoji: "😈", art: "   \\         ,        ,\n    \\       /(        )`\n     \\      \\ \\___   / |\n            /- _  `-/  '\n           (/\\/ \\ \\   /\\\n           / /   | `    \\\n           O O   ) /    |\n           `-^--'`<     '\n          (_.)  _  )   /\n           `.___/`    /\n             `-----' /\n<----.     __ / __   \\\n<----|====O)))==) \\) /====\n<----'    `--' `.__,' \\\n             |        |\n              \\       /\n        ______( (_  / \\______\n      ,'  ,-----'   |        \\\n      `--{__________)        \\/" },
    kitty: { emoji: "🐱", art: "  \\\n   \\\n      /\\_)o<\n     |      \\\n     | O . O|\n      \\_____/" },
    bunny: { emoji: "🐰", art: "  \\\n   \\   \\\n        \\ /\\\n        ( )\n      .( o )." },
    ghost: { emoji: "👻", art: "   \\\n    \\\n     .-.\n    (o o)\n    | O \\\n     \\   \\\n      `~~~'" },
  };

  const chars = (s) => Array.from(s);

  function wrap(text, width) {
    const lines = [];
    for (const para of String(text).split(/\r?\n/)) {
      let line = "";
      for (let word of para.split(/\s+/).filter(Boolean)) {
        while (chars(word).length > width) {
          if (line) { lines.push(line); line = ""; }
          lines.push(chars(word).slice(0, width).join(""));
          word = chars(word).slice(width).join("");
        }
        if (!line) line = word;
        else if (chars(line).length + 1 + chars(word).length <= width) line += " " + word;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines.length ? lines : [""];
  }

  function bubble(lines) {
    const w = Math.max(...lines.map((l) => chars(l).length));
    const pad = (l) => l + " ".repeat(w - chars(l).length);
    const out = [" " + "_".repeat(w + 2)];
    if (lines.length === 1) {
      out.push("< " + pad(lines[0]) + " >");
    } else {
      lines.forEach((l, i) => {
        const [a, b] = i === 0 ? ["/", "\\"] : i === lines.length - 1 ? ["\\", "/"] : ["|", "|"];
        out.push(a + " " + pad(l) + " " + b);
      });
    }
    out.push(" " + "-".repeat(w + 2));
    return out.join("\n");
  }

  function say(cow, message) {
    const c = COWS[cow] || COWS.cow;
    return bubble(wrap(message, WIDTH)) + "\n" + c.art;
  }

  function compose(cow, message, id) {
    return cow + DELIM + message + (id ? DELIM + "#" + id : "");
  }

  function parse(name) {
    name = name.replace(ID_SUFFIX, "");
    const i = name.indexOf(DELIM);
    if (i < 0) return { cow: "cow", message: name };
    const cow = name.slice(0, i);
    return { cow: COWS[cow] ? cow : "cow", message: name.slice(i + DELIM.length) };
  }

  const api = { COWS, DELIM, say, compose, parse };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Cowsay = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
