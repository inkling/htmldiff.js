describe('Diff', function(){
  var cut, res, html_to_tokens, calculate_operations;

  beforeEach(function(){
    cut = require('../js/htmldiff');
    html_to_tokens = cut.html_to_tokens;
    calculate_operations = cut.calculate_operations;
  });

  describe('When both inputs are the same', function(){
    beforeEach(function(){
      res = cut('input text', 'input text');
    });

    it('should return the text', function(){
      expect(res).equal('input text');
    });
  }); // describe('When both inputs are the same')

  describe('When a letter is added', function(){
    beforeEach(function(){
      res = cut('input', 'input 2');
    });

    it('should mark the new letter', function(){
      expect(res).to.equal('input<ins> 2</ins>');
    });
  }); // describe('When a letter is added')

  describe('Whitespace differences', function(){
    it('should collapse adjacent whitespace', function(){
      expect(cut('Much \n\t    spaces', 'Much spaces')).to.equal('Much spaces');
    });

    it('should consider non-breaking spaces as equal', function(){
      expect(cut('Hello&nbsp;world', 'Hello&#160;world')).to.equal('Hello&#160;world');
    });

    it('should consider non-breaking spaces and non-adjacent regular spaces as equal', function(){
      expect(cut('Hello&nbsp;world', 'Hello world')).to.equal('Hello world');
    });
  }); // describe('Whitespace differences')

  describe('When a class name is specified', function(){
    it('should include the class in the wrapper tags', function(){
      expect(cut('input', 'input 2', 'diff-result')).to.equal(
        'input<ins class="diff-result"> 2</ins>');
    });
  }); // describe('When a class name is specified')

  describe('Image Differences', function(){
    it('show two images as different if their src attributes are different', function() {
      var before = html_to_tokens('<img src="a.jpg">');
      var after = html_to_tokens('<img src="b.jpg">');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'replace',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });

    it('should show two images are the same if their src attributes are the same', function() {
      var before = html_to_tokens('<img src="a.jpg">');
      var after = html_to_tokens('<img src="a.jpg" alt="hey!">');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'equal',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });
  }); // describe('Image Differences')
  
  describe('Widget Differences', function(){
    it('show two widgets as different if their data attributes are different', function() {
      var before = html_to_tokens('<object data="a.jpg"></object>');
      var after = html_to_tokens('<object data="b.jpg"></object>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'replace',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });

    it('should show two widgets are the same if their data attributes are the same', function() {
      var before = html_to_tokens('<object data="a.jpg"><param>yo!</param></object>');
      var after = html_to_tokens('<object data="a.jpg"></object>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'equal',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });
  }); // describe('Widget Differences')

    describe('Math Differences', function(){
    it('should show two math elements as different if their contents are different', function() {
      var before = html_to_tokens('<math data-uuid="55784cd906504787a8e459e80e3bb554"><msqrt>' +
        '<msup><mi>b</mi><mn>2</mn></msup></msqrt></math>');
      var after = html_to_tokens('<math data-uuid="55784cd906504787a8e459e80e3bb554"><msqrt>' +
        '<msup><mn>b</mn><mn>5</mn></msup></msqrt></math>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'replace',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });

    it('should show two math elements as the same if their contents are the same', function() {
      var before = html_to_tokens('<math data-uuid="15568cd906504876548459e80e356878"><msqrt>' +
        '<msup><mi>b</mi><mn>2</mn></msup></msqrt></math>');
      var after = html_to_tokens('<math data-uuid="55784cd906504787a8e459e80e3bb554"><msqrt>' +
        '<msup><mi>b</mi><mn>2</mn></msup></msqrt></math>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'equal',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });
  }); // describe('Math Differences')

  describe('Video Differences', function(){
    it('show two widgets as different if their data attributes are different', function() {
      var before = html_to_tokens('<video data-uuid="0787866ab5494d88b4b1ee423453224b">' +
        '<source src="inkling-video:///big_buck_bunny/webm_high" type="video/webm" /></video>');
      var after = html_to_tokens('<video data-uuid="0787866ab5494d88b4b1ee423453224b">' +
        '<source src="inkling-video:///big_buck_rabbit/mp4" type="video/webm" /></video>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'replace',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });

    });

    it('should show two widgets are the same if their data attributes are the same', function() {
      var before = html_to_tokens('<video data-uuid="65656565655487787484545454548494">' +
        '<source src="inkling-video:///big_buck_bunny/webm_high" type="video/webm" /></video>');
      var after = html_to_tokens('<video data-uuid="0787866ab5494d88b4b1ee423453224b">' +
        '<source src="inkling-video:///big_buck_bunny/webm_high" type="video/webm" /></video>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'equal',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });
  }); // describe('Video Differences')

  describe('iframe Differences', function(){
    it('show two widgets as different if their data attributes are different', function() {
      var before = html_to_tokens('<iframe src="a.jpg"></iframe>');
      var after = html_to_tokens('<iframe src="b.jpg"></iframe>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'replace',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });

    it('should show two widgets are the same if their data attributes are the same', function() {
      var before = html_to_tokens('<iframe src="a.jpg"></iframe>');
      var after = html_to_tokens('<iframe src="a.jpg" class="foo"></iframe>');
      var ops = calculate_operations(before, after);
      expect(ops.length).to.equal(1);
      expect(ops[0]).to.eql({
        action: 'equal',
        start_in_before: 0,
        end_in_before: 0,
        start_in_after: 0,
        end_in_after: 0
      });
    });
  }); // describe('iframe Differences')
  
}); // describe('Diff')
