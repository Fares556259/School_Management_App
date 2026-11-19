"""Strict register staging. Original PDF Unicode is preserved without normalization."""
import sys, json, hashlib, re
import pymupdf as fitz
FIELDS = {'nationalId':8,'name':7,'surname':6,'sex':5,'level':2,'guardianName':4,'guardianPhone':3}
X = [36,117.91,199.825,289.94,380.045,478.34,535.68,617.595,699.51,806]

def extract(data):
    doc=fitz.open(stream=data,filetype='pdf')
    if doc.needs_pass or not 1 <= len(doc) <= 50: raise ValueError('Unsupported document')
    result=dict(version=1,profile='tn-student-register-v1',sourceSha256=hashlib.sha256(data).hexdigest(),pageCount=len(doc),rows=[],issues=[],ignoredFields=['registrationDate'])
    seen={}
    for n,page in enumerate(doc):
        tables=page.find_tables().tables
        if len(tables)!=1 or tables[0].col_count!=9 or abs(page.rect.width-842)>1:
            result['issues'].append(dict(code='layout',message=f'Page {n+1}: unsupported table layout'));continue
        table=tables[0]
        raw=page.get_text('rawdict')
        source_lines=[]
        for block in raw['blocks']:
            for line in block.get('lines',[]):
                source_lines.append([(char['c'], fitz.Point(char['origin']) * page.rotation_matrix) for span in line['spans'] for char in span['chars']])
        if any(abs(table.rows[0].cells[i][0]-X[i])>1 for i in range(9)):
            result['issues'].append(dict(code='columns',message=f'Page {n+1}: column boundaries changed'));continue
        for index,row in enumerate(table.rows[1:] if n == 0 else table.rows,1):
            rid=f'p{n+1}-r{index}'
            record=dict(id=rid,page=n+1,row=index,cells={},issues=[])
            for field,col in FIELDS.items():
                rect=fitz.Rect(row.cells[col])
                # Content stream order preserves Arabic characters and combining marks.
                lines=[]
                for source_line in source_lines:
                    chars=[char for char,origin in source_line if rect.x0 <= origin.x < rect.x1 and rect.y0 <= origin.y < rect.y1]
                    if chars: lines.append(''.join(chars))
                text='\n'.join(lines)
                valid=bool(text.strip()) and '\ufffd' not in text
                if field=='nationalId': valid=valid and re.fullmatch(r'[0-9]{12}',text) is not None
                if field=='guardianPhone': valid=valid and re.fullmatch(r'[0-9]{8}',text) is not None
                record['cells'][field]=dict(text=text,bbox=list(rect),verified=valid)
                if not valid:record['issues'].append(dict(code='cell_review',message='Missing, ambiguous or invalid source cell',rowId=rid,field=field))
            ident=record['cells']['nationalId']['text']
            if ident in seen:record['issues'].append(dict(code='duplicate',message=f'Duplicate identifier also in {seen[ident]}',rowId=rid,field='nationalId'))
            seen[ident]=rid
            result['rows'].append(record)
    return result
if __name__=='__main__':
    data=sys.stdin.buffer.read(4_000_001)
    if len(data)>4_000_000:raise ValueError('PDF too large')
    if len(sys.argv)>1:
        import base64
        doc=fitz.open(stream=data,filetype='pdf')
        page=int(sys.argv[1])
        if not 1 <= page <= len(doc): raise ValueError('Invalid page')
        print(base64.b64encode(doc[page-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).tobytes('png')).decode())
        sys.exit(0)
    # PyMuPDF table finder may emit advisory text; keep stdout JSON-only.
    import contextlib
    with contextlib.redirect_stdout(sys.stderr): result=extract(data)
    print(json.dumps(result,ensure_ascii=False))
