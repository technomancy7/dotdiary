# DotDiary
A simple CLI/textual diary system.

## CLI
```bash
diary write #Opens diary entry editor.  -d <date> to use a different date. If entry already exists, will add existing text to the edit.
diary show #Shows todays entry, or another dates with -d <date>
diary sort #sorts entries by date, add -r to reverse order
diary print #shows all entries
diary append "This is a new line!" #Adds text to entry, again, today by default, -d for different date.
diary set editor vim #Changes setting
diary edit #Edits entire diary file in text

# Select the date easier with --days-ago <num> and --weeks-ago <num>
```

## Build
Requires [Bun](https://bun.sh) runtime.<br>
Either run as a script with `bun diary.js [arguments]` from the script directory, or run the build script with `bun b` to automatically compile<br>
and move the executable to ~/.local/bin for global use. (Linux only)

## Examples
The top of the diary text file can contain settings values.
```
.settings
@json false
@author Techno
@editor hx
```
<br>
A complete diary entry;

```
.diary 05-07-2025
I wrote this readme!
@coding
@mood good
```
