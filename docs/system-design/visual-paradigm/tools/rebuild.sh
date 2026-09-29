#!/bin/sh
# Rebuilds docs/system-design/visual-paradigm from the Mermaid sources in
# docs/system-design/new-system-design, plus the seven views in draw.io/tools/views.py.
#
#     sh docs/system-design/visual-paradigm/tools/rebuild.sh
#
# Needs Visual Paradigm (Community Edition is enough) in /Applications and a JDK 11+ `javac`
# (JAVA_HOME or PATH). Close the project in Visual Paradigm first: it is replaced.
#
#  1. build_spec.py reads each diagram's Mermaid source and its draw.io layout -> spec.tsv
#  2. the builder plugin (tools/plugin) is compiled and installed into Visual Paradigm
#  3. the plugin measures every shape at its final font; layout.py places the shapes and routes
#     every line at right angles around them; the plugin then draws exactly that, natively
#  4. each diagram is exported as a PNG next to where the draw.io one lives
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$(dirname "$HERE")
APP="/Applications/Visual Paradigm.app/Contents/Resources/app"
VPJAVA="/Applications/Visual Paradigm.app/Contents/Resources/jre.bundle/Contents/Home/bin/java"
PLUGINS="$HOME/Library/Application Support/VisualParadigm/plugins/eksamadhan.vpbuild"
PROJECT="$OUT/EkSamadhan-AI.vpp"
WORK=${VPBUILD_WORK:-$(mktemp -d)}
mkdir -p "$WORK"
[ -n "$VPBUILD_WORK" ] || trap 'rm -rf "$WORK"' EXIT

JAVAC=${JAVA_HOME:+$JAVA_HOME/bin/}javac

# Visual Paradigm's own scripts pass -XX:MaxPermSize, which its bundled Java 11 refuses.
vp() {
    CLS=$1; shift
    CP=".:../lib/vpplatform.jar:../lib/jniwrap.jar:../lib/winpack.jar:../ormlib/orm.jar:../ormlib/orm-core.jar"
    for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20; do CP="$CP:../lib/lib$i.jar"; done
    (cd "$APP/bin" && "$VPJAVA" -Xms256m -Xmx2g -Djava.awt.headless=true -cp "$CP" "com.vp.cmd.$CLS" "$@")
}

echo "1/4 spec"
python3 "$HERE/build_spec.py" "$WORK/spec.tsv"

echo "2/4 plugin"
mkdir -p "$WORK/classes" "$PLUGINS/lib"
"$JAVAC" --release 11 -cp "$APP/lib/openapi.jar" -d "$WORK/classes" "$HERE"/plugin/src/vpbuild/*.java
(cd "$WORK/classes" && jar cf "$PLUGINS/lib/vpbuild.jar" .)
cp "$HERE/plugin/plugin.xml" "$PLUGINS/plugin.xml"

echo "3/4 project"
cat > "$WORK/empty.xml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<Project Name="EkSamadhan AI" UmlVersion="2.x" Xml_structure="simple"><Models/><Diagrams/></Project>
XML
rm -f "$PROJECT"
vp ImportXML -project "$PROJECT" -file "$WORK/empty.xml" > "$WORK/import.log" 2>&1
# Pass one measures every shape at its final font; layout.py places and routes with those
# sizes; pass two draws exactly that.
# (VPBUILD_REUSE_SIZES=1 with VPBUILD_WORK keeps an earlier measurement: text unchanged.)
if [ -z "$VPBUILD_REUSE_SIZES" ] || [ ! -s "$WORK/sizes.tsv" ]; then
    # Visual Paradigm now and then fails inside its own undo stack (EmptyStackException) on a
    # fresh project; a second try on a clean copy goes through.
    for try in 1 2; do
        cp "$PROJECT" "$WORK/measure.vpp"
        vp Plugin -project "$WORK/measure.vpp" -pluginid eksamadhan.vpbuild -pluginargs "--measure $WORK/spec.tsv $WORK/sizes.tsv" > "$WORK/measure.log" 2>&1 || true
        grep -q "VPBUILD measured=" "$WORK/measure.log" && break
    done
    grep -q "VPBUILD measured=" "$WORK/measure.log" || { cat "$WORK/measure.log"; exit 1; }
fi
python3 "$HERE/layout.py" "$WORK/spec.tsv" "$WORK/sizes.tsv" "$WORK/final.tsv"
vp Plugin -project "$PROJECT" -pluginid eksamadhan.vpbuild -pluginargs "$WORK/final.tsv" > "$WORK/build.log" 2>&1 || true
grep VPBUILD "$WORK/build.log" || { cat "$WORK/build.log"; exit 1; }
EXPECT=$(grep -c '^DIAGRAM' "$WORK/spec.tsv")
grep -q "VPBUILD diagrams=$EXPECT saved=true" "$WORK/build.log" || exit 1
# The supervisor's views also get a project of their own in their folder, so each can be
# opened alone: <folder>/<folder>.vpp, holding only that folder's hand-placed diagrams.
for folder in business-context functional-architecture data-flow-diagram system-architecture use-case; do
    awk -F '\t' -v want="$folder" '$1 == "DIAGRAM" { keep = ($4 == want && $6 == "FIXED") } keep' \
        "$WORK/final.tsv" > "$WORK/$folder.tsv"
    n=$(grep -c '^DIAGRAM' "$WORK/$folder.tsv" || true)
    [ "$n" -gt 0 ] || continue
    rm -f "$OUT/$folder/$folder.vpp"
    vp ImportXML -project "$OUT/$folder/$folder.vpp" -file "$WORK/empty.xml" > "$WORK/$folder-import.log" 2>&1
    vp Plugin -project "$OUT/$folder/$folder.vpp" -pluginid eksamadhan.vpbuild -pluginargs "$WORK/$folder.tsv" > "$WORK/$folder.log" 2>&1 || true
    grep -q "VPBUILD diagrams=$n saved=true" "$WORK/$folder.log" || { cat "$WORK/$folder.log"; exit 1; }
    echo "  $folder/$folder.vpp: $n diagram(s)"
done
rm -f "$OUT"/*/*.vpp.bak*
echo "4/4 images"
rm -rf "$WORK/png"      # the export writes "name2.png" beside an existing file, never over it
vp ExportDiagramImage -project "$PROJECT" -out "$WORK/png" -diagram '*' -type png_with_background > "$WORK/export.log" 2>&1
# Diagram name -> folder/stem, from the spec's DIAGRAM records.
grep '^DIAGRAM' "$WORK/spec.tsv" | while IFS="$(printf '\t')" read -r _ _kind name folder stem _dir; do
    mkdir -p "$OUT/$folder"
    cp "$WORK/png/$name.png" "$OUT/$folder/$stem.png"
done
rm -f "$OUT"/*.vpp.bak*
echo "done: $PROJECT"
