//const argParser = require('yargs-parser')
import argParser from 'yargs-parser'
import { $ } from "bun";
const dayjs = require('dayjs')
var relativeTime = require("dayjs/plugin/relativeTime");
dayjs.extend(relativeTime)
var customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);
var duration = require("dayjs/plugin/duration");
dayjs.extend(duration);
var updateLocale = require('dayjs/plugin/updateLocale')

dayjs.extend(updateLocale, {
  thresholds: [
    { l: 's', r: 1 }, { l: 'm', r: 1 }, { l: 'mm', r: 59, d: 'minute' }, { l: 'h', r: 1 }, { l: 'hh', r: 23, d: 'hour' },
    { l: 'd', r: 1 }, { l: 'dd', r: 29, d: 'day' }, { l: 'M', r: 1 }, { l: 'MM', r: 11, d: 'month' },  { l: 'y', r: 1 }, { l: 'yy', d: 'year' }
  ]
})

dayjs.updateLocale('en', {
  relativeTime: {
    future: "in %s", past: "%s ago", s: 'a few seconds', m: "a minute", mm: "%d minutes", h: "an hour", hh: "%d hours", d: "a day",
    dd: "%d days", M: "a month", MM: "%d months", y: "a year", yy: "%d years"
  }
})

export class Diary {
    constructor() {
        this.diaryFile = process.env.DOT_DIARY || process.env.HOME+"/.diary.txt";
        this.diaryFileEntry = process.env.DOT_DIARY_ENTRY || process.env.HOME+"/.diary.entry.txt";

        this.state = {}
        this.settings = {}
    }

    dateFormat() {
        return this.settings.dateFormat || "DD-MM-YYYY";
    }

    resetState() {
        this.state = {};
        this.settings = {};
    }

    sortEntries(reverse = false) {
        // Step 1: Convert object to array of [key, value] pairs
        const entries = Object.entries(this.state);

        // Step 2: Sort the array based on parsed dates
        entries.sort((a, b) => {
            const dateA = dayjs(a[0], this.dateFormat());
            const dateB = dayjs(b[0], this.dateFormat());
            if(!reverse) return dateA - dateB; // Sort from earliest to latest
            if(reverse) return dateB - dateA // latest to earliest
        });

        // Step 3: Reconstruct the sorted object (optional)
        this.state = Object.fromEntries(entries);
    }

    async editFile(entryFile = false) {
        let editor = this.settings.editor || Bun.env.EDITOR || null
        if(editor != null) {
            if(!entryFile) await $`${editor} ${this.diaryFile}`;
            else {

                await $`${editor} ${this.diaryFileEntry}`;
            }
        } else {
            console.log("No editor defined. Use either `@editor <executable>` settings property, or ENV EDITOR.")
        }

    }
    async loadFile(path = undefined) {
        if(path == undefined) path = this.diaryFile;
        const i = Bun.file(path);
        const exists = await i.exists();
        if(exists) {
            const lines = await i.text()
            let currentEntry = null;
            let inSettings = false;

            for(const line of lines.split("\n")) {
                if(line == "") continue;

                if(line == ".settings") { // Enter settings block
                    //console.log("Defined settings...")
                    inSettings = true;

                } else if(line.startsWith(".diary ")) { //Create new entry
                    inSettings = false;
                    if(currentEntry != null) { //Commit current in-progress entry and reset
                        //console.log(`Saving entry ${currentEntry.date}...`)
                        this.state[currentEntry.date] = currentEntry;
                        currentEntry = null;

                        //console.log(this.state)
                    }

                    currentEntry = {
                        lines: [],
                        properties: {},
                        date: line.split(" ")[1]
                    }
                    //console.log(`New entry ${currentEntry.date}...`)
                } else if(line.startsWith("@")) {
                    let key = line.split(" ")[0].slice(1)
                    let val = line.split(" ").slice(1).join(" ")
                    if(val == "") val = true;
                    else if(val == "false") val = false;
                    else if(key.includes(":")) {
                        const nuType = key.split(":")[1]
                        key = key.split(":")[0]
                        if(nuType == "int") val = parseInt(val)
                        if(nuType == "list") val = val.split("|")
                    }
                    if(inSettings == true) {
                        this.settings[key] = val
                    } else {
                        currentEntry.properties[key] = val
                    }

                } else {
                    currentEntry.lines.push(line)
                }
            }
            this.state[currentEntry.date] = currentEntry; //Saving final entry
        }
    }

    async exportFile(path = null, onlyDate = null) {
        if(path == null) path = this.diaryFile;
        let text = [];

        if(!onlyDate && Object.keys(this.settings).length > 0){
            text.push(".settings")
            for(let [key, val] of Object.entries(this.settings)) {
                if(typeof val == "string") text.push(`@${key} ${val}`.trim())
                if(typeof val == "number") text.push(`@${key}:int ${val}`.trim())
                if(typeof val == "boolean" && val == true) text.push(`@${key}`.trim())
                if(typeof val == "boolean" && val == false) text.push(`@${key} false`.trim())
                if(typeof val == "object" && Array.isArray(val)) text.push(`@${key}:list ${val.join("|")}`.trim())
            }
        }
        text.push("")

        if(this.state[onlyDate] == undefined && onlyDate != null) text.push(`.diary ${onlyDate}\n`)

        for(let [key, diaryEntry] of Object.entries(this.state)) {
            if(onlyDate && key != onlyDate) continue;
            text.push(`.diary ${key}`.trim())

            for(let line of diaryEntry.lines) {
                text.push(line.trim())
            }

            for(let [key, val] of Object.entries(diaryEntry.properties)) {
                if(typeof val == "string") text.push(`@${key} ${val}`.trim())
                if(typeof val == "number") text.push(`@${key}:int ${val}`.trim())
                if(typeof val == "boolean" && val == true) text.push(`@${key}`.trim())
                if(typeof val == "boolean" && val == false) text.push(`@${key} false`.trim())
                if(typeof val == "object" && Array.isArray(val)) text.push(`@${key}:list ${val.join("|")}`.trim())
            }
            text.push("")
        }


        await Bun.write(path, text.join("\n").trim()); //console.log(text.join("\n"))
    }
}

if(import.meta.main) {
    let diary = new Diary();
    await diary.loadFile();
    const args = argParser(process.argv.slice(2));
    let entry = null
    let date = args.d || args.date || dayjs().format(diary.dateFormat())
    if(date == "yesterday") date = dayjs().subtract(1, "day").format(diary.dateFormat())
    if(args.daysAgo) date = dayjs().subtract(parseInt(args.daysAgo), "day").format(diary.dateFormat())
    if(args.weeksAgo) date = dayjs().subtract(parseInt(args.weeksAgo), "week").format(diary.dateFormat())
    switch (args._[0]) {
        case "help":
            console.log("write")
            console.log("append")
            console.log("delete")
            console.log("sort")
            console.log("show")
            console.log("set <key> <value>")
            console.log("edit")
            console.log("Date Selection: --date <DD-MM-YY> --days-ago <number> --weeks-ago <number>")
            break;

        case "print":
            console.log(diary.state)

            break;

        case "sort":
            diary.sortEntries(args.r || false);
            await diary.exportFile();
            break;

        case "show":
            entry = diary.state[date];
            if(entry == undefined){
                console.log("No entry for this date.")
            } else {
                console.log(entry)
            }
            break;

        case "set":
            let key = args._[1]
            let val = args._.slice(2).join(" ")

            if(key.includes(":")) {
                const nuType = key.split(":")[1]
                key = key.split(":")[0]
                if(nuType == "int") val = parseInt(val)
                if(nuType == "list") val = val.split("|")
            }

            entry = diary.state[date];

            if(entry == undefined) {
                entry = {
                    lines: [],
                    date: date,
                    properties: {}
                }
            }
            entry.properties[key] = val
            diary.state[date] = entry
            await diary.exportFile()

            break;

        case "append":
            let text = args._.slice(1).join(" ")

            entry = diary.state[date];
            if(entry == undefined) {
                entry = {
                    lines: [],
                    date: date,
                    properties: {}
                }
            }
            entry.lines.push(text)
            diary.state[date] = entry
            await diary.exportFile()
            break;

        case "delete":
            delete diary.state[date];
            await diary.exportFile();
            break;

        case "edit":
            if(args.e) diary.settings.editor = args.e;
            await diary.editFile();
            break;

        case "write":
        case "write entry":
            await diary.exportFile(diary.diaryFileEntry, date); //export single entry to edit file
            await diary.editFile(true); //opens edit file in editor
            await diary.loadFile(diary.diaryFileEntry); //loads the edit file in to state
            await diary.exportFile(); //export new state to main file
            await Bun.file(diary.diaryFileEntry).delete(); //cleanup edit file
            break;

        case "import":
            let load_file = args.f || null; //define what file to import
            if(load_file == null) {console.log("No import file specified. (-f <file>)") } else {
                await diary.loadFile(load_file) //Add the new file
                diary.sortEntries(); //Make sure everything is in the right order before exporting
                await diary.exportFile() //Save all to main
            }

            break;

        default:
            console.log(`Unknown input.`);
    }
}
