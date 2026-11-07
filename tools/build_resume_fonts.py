"""Build the resume's self-hosted WOFF2 fonts (build-time fonttools + brotli only).

Download the official Noto variable TTF files listed in assets/fonts/README.md.
Run with --source-dir pointing to their directory. Rebuild after adding content.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
from shutil import copyfile

from fontTools import subset
from fontTools.ttLib import TTFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--inter', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = root/'assets'/'fonts'
    destination.mkdir(parents=True, exist_ok=True)
    text = (root/'index.html').read_text(encoding='utf-8')
    text = re.sub(r'data:image/[^;]+;base64,[A-Za-z0-9+/=]+', '', text)
    text += '\n'.join(p.read_text(encoding='utf-8') for p in (root/'assets').glob('*.mjs'))
    # All current content, punctuation, Latin, Greek and common mathematical symbols.
    points = set(map(ord, text)) | set(range(0x20,0x250)) | set(range(0x370,0x400)) | set(range(0x2000,0x2070)) | set(range(0x2190,0x2300)) | set(range(0x3000,0x3040))
    chinese = {c for c in map(ord,text) if 0x3400<=c<=0x9fff}
    manifest = {'content_cjk_characters':len(chinese),'families':[]}
    for family, input_name, slug in [('Noto Sans SC','NotoSansSC.ttf','resume-sans'),('Noto Serif SC','NotoSerifSC.ttf','resume-serif')]:
        source = args.source_dir/input_name
        font = TTFont(source, recalcTimestamp=False)
        missing = chinese - set(font.getBestCmap())
        if missing:
            raise ValueError(f'{family}: missing Chinese characters: {missing}')
        options = subset.Options()
        options.layout_features = ['*']
        options.name_IDs = ['*']
        options.name_legacy = True
        options.name_languages = ['*']
        worker = subset.Subsetter(options)
        worker.populate(unicodes=points)
        worker.subset(font)
        font.flavor = 'woff2'
        staging = destination/(slug+'.woff2')
        font.save(staging)
        digest = hashlib.sha256(staging.read_bytes()).hexdigest()[:10]
        output = destination/f'{slug}-{digest}.woff2'
        staging.replace(output)
        with TTFont(output) as check:
            if chinese - set(check.getBestCmap()):
                raise ValueError('Subset lost required Chinese glyphs')
            axes = {axis.axisTag:[axis.minValue,axis.maxValue] for axis in check['fvar'].axes}
        manifest['families'].append({'family':family,'file':output.name,'bytes':output.stat().st_size,'axes':axes,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
    inter_name='inter-variable-4.1.woff2'
    copyfile(args.inter,destination/inter_name)
    manifest['families'].append({'family':'Inter Variable','file':inter_name,'bytes':(destination/inter_name).stat().st_size})
    (destination/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
