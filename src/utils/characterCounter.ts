export class CharacterCounter {
	/**
	 * 空白、改行、全角スペースを除外して文字数をカウント
	 */
	public static count(text: string): number {
		// Intl.Segmenter を使うと絵文字なども1文字として正確に数えられます
		const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
		const segments = [...segmenter.segment(text)];
		
		// 改行、タブ、半角スペース、全角スペース (\u3000) を除外
		return segments.filter(seg => !/[\s\t\n\r\u3000]/.test(seg.segment)).length;
	}
}