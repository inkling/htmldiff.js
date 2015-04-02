/*
 * htmldiff.js is a library that compares HTML content. It creates a diff between two
 * HTML documents by combining the two documents and wrapping the differences with
 * <ins> and <del> tags. Here is a high-level overview of how the diff works.
 *
 * 1. Tokenize the before and after HTML with html_to_tokens.
 * 2. Generate a list of operations that convert the before list of tokens to the after
 *    list of tokens with calculate_operations, which does the following:
 *      a. Find all the matching blocks of tokens between the before and after lists of
 *         tokens with find_matching_blocks. This is done by finding the single longest
 *         matching block with find_match, then iteratively finding the next longest
 *         matching blocks that precede and follow the longest matching block.
 *      b. Determine insertions, deletions, and replacements from the matching blocks.
 *         This is done in calculate_operations.
 * 3. Render the list of operations by wrapping tokens with <ins> and <del> tags where
 *    appropriate with render_operations.
 *
 * Example usage:
 *
 *   var htmldiff = require('htmldiff.js');
 *
 *   htmldiff('<p>this is some text</p>', '<p>this is some more text</p>')
 *   == '<p>this is some <ins>more </ins>text</p>'
 *
 *   htmldiff('<p>this is some text</p>', '<p>this is some more text</p>', 'diff-class')
 *   == '<p>this is some <ins class="diff-class">more </ins>text</p>'
 */
(function(){
  "use strict";

  function is_end_of_tag(char){
    return char === '>';
  }

  function is_start_of_tag(char){
    return char === '<';
  }

  function is_whitespace(char){
    return /^\s+$/.test(char);
  }

  function is_tag(token){
    return /^\s*<[^>]+>\s*$/.test(token);
  }

  function isnt_tag(token){
    return !is_tag(token);
  }

  /*
   * Checks if the current word is the beginning of an atomic tag. An atomic tag is one whose
   * child nodes should not be compared - the entire tag should be treated as one token. This
   * is useful for tags where it does not make sense to insert <ins> and <del> tags.
   *
   * @param {string} word The characters of the current token read so far.
   *
   * @return {string|null} The name of the atomic tag if the word will be an atomic tag,
   *    null otherwise
   */
  function is_start_of_atomic_tag(word){
    var result = /^<(iframe|object|math|svg|script|video)/.exec(word);
    if (result){
      result = result[1];
    }
    return result;
  }

  /*
   * Checks if the current word is the end of an atomic tag (i.e. it has all the characters,
   * except for the end bracket of the closing tag, such as '<iframe></iframe').
   *
   * @param {string} word The characters of the current token read so far.
   * @param {string} tag The ending tag to look for.
   *
   * @return {boolean} True if the word is now a complete token (including the end tag),
   *    false otherwise.
   */
  function is_end_of_atomic_tag(word, tag){
    return word.substring(word.length - tag.length - 2) === ('</' + tag);
  }

  /*
   * Checks if a tag is a void tag.
   *
   * @param {string} token The token to check.
   *
   * @return {boolean} True if the token is a void tag, false otherwise.
   */
  function is_void_tag(token){
    return /^\s*<[^>]+\/>\s*$/.test(token);
  }

  /*
   * Checks if a token can be wrapped inside a tag.
   *
   * @param {string} token The token to check.
   *
   * @return {boolean} True if the token can be wrapped inside a tag, false otherwise.
   */
  function is_wrappable(token){
    var is_img = /^<img[\s>]/.test(token);
    return is_img|| isnt_tag(token) || is_start_of_atomic_tag(token) || is_void_tag(token);
  }

  /**
   * Creates a token that holds a string and key representation. The key is used for diffing
   * comparisons and the string is used to recompose the document after the diff is complete.
   *
   * @param {string} current_word The section of the document to create a token for.
   *
   * @return {Object} A token object with a string and key property.
   */
  function create_token(current_word) {
    return {
      string: current_word,
      key: get_key_for_token(current_word)
    };
  }

  /*
   * A Match stores the information of a matching block. A matching block is a list of
   * consecutive tokens that appear in both the before and after lists of tokens.
   *
   * @param {number} start_in_before The index of the first token in the list of before tokens.
   * @param {number} start_in_after The index of the first token in the list of after tokens.
   * @param {number} length The number of consecutive matching tokens in this block.
   * @param {Segment} segment The segment where the match was found.
   */
  function Match(start_in_before, start_in_after, length, segment){
    this.segment = segment;
    this.length = length;

    this.start_in_before = start_in_before + segment.before_index;
    this.start_in_after = start_in_after + segment.after_index;
    this.end_in_before = this.start_in_before + this.length - 1;
    this.end_in_after = this.start_in_after + this.length - 1;
    
    this.segment_start_in_before = start_in_before;
    this.segment_start_in_after = start_in_after;
    this.segment_end_in_before = (this.segment_start_in_before + this.length) - 1;
    this.segment_end_in_after = (this.segment_start_in_after + this.length) - 1;
  }

  /*
   * Tokenizes a string of HTML.
   *
   * @param {string} html The string to tokenize.
   *
   * @return {Array.<string>} The list of tokens.
   */
  function html_to_tokens(html){
    var mode = 'char';
    var current_word = '';
    var current_atomic_tag = '';
    var words = [];
    for (var i = 0; i < html.length; i++){
      var char = html[i];
      switch (mode){
        case 'tag':
          var atomic_tag = is_start_of_atomic_tag(current_word);
          if (atomic_tag){
            mode = 'atomic_tag';
            current_atomic_tag = atomic_tag;
            current_word += char;
          } else if (is_end_of_tag(char)){
            current_word += '>';
            words.push(create_token(current_word));
            current_word = '';
            if (is_whitespace(char)){
              mode = 'whitespace';
            } else {
              mode = 'char';
            }
          } else {
            current_word += char;
          }
          break;
        case 'atomic_tag':
          if (is_end_of_tag(char) && is_end_of_atomic_tag(current_word, current_atomic_tag)){
            current_word += '>';
            words.push(create_token(current_word));
            current_word = '';
            current_atomic_tag = '';
            mode = 'char';
          } else {
            current_word += char;
          }
          break;
        case 'char':
          if (is_start_of_tag(char)){
            if (current_word){
              words.push(create_token(current_word));
            }
            current_word = '<';
            mode = 'tag';
          } else if (/\s/.test(char)){
            if (current_word){
              words.push(create_token(current_word));
            }
            current_word = char;
            mode = 'whitespace';
          } else if (/[\w\d\#@]/.test(char)){
            current_word += char;
          } else if (/&/.test(char)){
            if (current_word){
              words.push(create_token(current_word));
            }
            current_word = char;
          } else {
            current_word += char;
            words.push(create_token(current_word));
            current_word = '';
          }
          break;
        case 'whitespace':
          if (is_start_of_tag(char)){
            if (current_word){
              words.push(create_token(current_word));
            }
            current_word = '<';
            mode = 'tag';
          } else if (is_whitespace(char)){
            current_word += char;
          } else {
            if (current_word){
              words.push(create_token(current_word));
            }
            current_word = char;
            mode = 'char';
          }
          break;
        default:
          throw new Error('Unknown mode ' + mode);
      }
    }
    if (current_word){
      words.push(create_token(current_word));
    }
    return words;
  }

  /*
   * Creates a key that should be used to match tokens. This is useful, for example, if we want
   * to consider two open tag tokens as equal, even if they don't have the same attributes. We
   * use a key instead of overwriting the token because we may want to render the original string
   * without losing the attributes.
   *
   * @param {string} token The token to create the key for.
   *
   * @return {string} The identifying key that should be used to match before and after tokens.
   */
  function get_key_for_token(token){
    // If the token is an image element, grab it's src attribute to include in the key.
    var img = /^<img.*src=['"]([^"']*)['"].*>$/.exec(token);
    if (img) {
      return '<img src="' + img[1] + '">';
    }

    // If the token is an object element, grab it's data attribute to include in the key.
    var object = /^<object.*data=['"]([^"']*)['"]/.exec(token);
    if (object) {
      return '<object src="' + object[1] + '"></object>';
    }

    // If it's a video, math or svg element, the entire token should be compared except the
    // data-uuid.
    if(/^<(svg|math|video)[\s>]/.test(token)) {
      var uuid = token.indexOf('data-uuid="');
      if (uuid !== -1) {
        var start = token.slice(0, uuid);
        var end = token.slice(uuid + 44);
        return start + end;
      } else {
        return token;
      } 
    }

    // If the token is an iframe element, grab it's src attribute to include in it's key.
    var iframe = /^<iframe.*src=['"]([^"']*)['"].*>/.exec(token);
    if (iframe) {
      return '<iframe src="' + iframe[1] + '"></iframe>';
    }

    // If token any other element, just grab the tag name.
    var tag_name = /<([^\s>]+)[\s>]/.exec(token);
    if (tag_name){
      return '<' + (tag_name[1].toLowerCase()) + '>';
    }

    // Otherwise, the token is text, collapse the whitespace.
    if (token){
      return token.replace(/(\s+|&nbsp;|&#160;)/g, ' ');
    }
    return token;
  }

  /*
   * Creates an index (A.K.A. hash table) that will be used to match the list of before
   * tokens with the list of after tokens.
   *
   * @param {Array.<string>} in_these The list of tokens that will be returned.
   *
   * @return {Object} An index that can be used to search for tokens.
   */
  function create_index(in_these){
    var results = in_these.map(function(token){
      return token.key;
    });

    var items = {};
    for (var i = 0; i < results.length; i++){
      var item = results[i];
      if (!items[item]) {
        items[item] = [];
      }
      items[item].push(i);
    }

    return items;
  }

  /**
   * Compares two match objects to determine if the second match object comes before or after the
   * first match object. Returns -1 if the m2 should come before m1. Returns 1 if m1 should come
   * before m2. If the two matches criss-cross each other, a null is returned.
   *
   * @param {Match} m1 The first match object to compare.
   * @param {Match} m2 The second match object to compare.
   *
   * @return {number|null} Returns -1 if the m2 should come before m1. Returns 1 if m1 should come
   *    before m2. If the two matches criss-cross each other, a null is returned.
   */
  function compare_matches(m1, m2) {
    if (m2.end_in_before < m1.start_in_before && m2.end_in_after < m1.start_in_after) {
      return -1;
    } else if (m2.start_in_before > m1.end_in_before && m2.start_in_after > m1.end_in_after) {
      return 1;
    } else {
      return null;
    }
  }

  /**
   * A constructor for a binary search tree used to keep match objects in the proper order as
   * they're found.
   *
   * @constructor
   */
  function MatchBinarySearchTree() {
    this._root = null;
  }

  MatchBinarySearchTree.prototype = {
    /**
     * Adds matches to the binary search tree.
     *
     * @param {Match} value The match to add to the binary search tree.
     */
    add: function (value){
      // Create the node to hold the match value.
      var node = {
        value: value,
        left: null,
        right: null
      };

      var current = this._root;
      if(current) {
        while (true) {
          // Determine if the match value should go to the left or right of the current node.
          var position = compare_matches(current.value, value);
          if (position === -1) {
            // The position of the match is to the left of this node.
            if (current.left) {
              current = current.left;
            } else {
              current.left = node;
              break;
            }
          } else if (position === 1) {
            // The position of the match is to the right of this node.
            if (current.right) {
              current = current.right;
            } else {
              current.right = node;
              break;
            }
          } else {
            // If a null value was returned from compare_matches, that means the node cannot
            // be inserted because it overlaps an existing node.
            break;
          }
        }
      } else {
        // If no nodes exist in the tree, make this the root node.
        this._root = node;
      }
    },

    /**
     * Converts the binary search tree into an array using a depth-first traversal.
     *
     * @return {Array.<Match>} An array containing the matches in the binary search tree.
     */
    to_array: function(){
      var nodes = [];

      function depth_first(node) {
        if (node) {
          if (node.left) {
            depth_first(node.left);
          }

          nodes.push(node.value);

          if (node.right) {
            depth_first(node.right);
          }
        }
      }

      depth_first(this._root);
      return nodes;
    }
  };


  /*
   * Finds and returns the best match between the before and after arrays contained in the segment
   * provided.
   *
   * @param {Segment} segment The segment in which to look for a match.
   *
   * @return {Match} The best match.
   */
  function find_best_match(segment){
    var before_tokens = segment.before_tokens;
    var after_map = segment.after_map;
    var last_space = null;
    var best_match = null;

    // Iterate through the entirety of the before_tokens to find the best match.
    for (var before_index = 0; before_index < before_tokens.length; before_index++){
      var look_behind = false;

      // If the current best match is longer than the remaining tokens, we can bail because we
      // won't find a better match.
      var remaining_tokens = before_tokens.length - before_index;
      if (best_match && remaining_tokens < best_match.length) {
        break;
      }

      // If the current token is whitespace, make a note of it and move on. Trying to start a set
      // of matches with whitespace is not efficient because it's too prevelant in most documents.
      // Instead, if the next token yields a match, we'll see if the whitespace can be included in
      // that match.
      var before_token = before_tokens[before_index];
      if (before_token.key === ' ') {
        last_space = before_index;
        continue;
      }

      // Check to see if we just skipped a space, if so, we'll ask get_full_match to look behind
      // by one token to see if it can include the whitespace.
      if (last_space === before_index - 1) {
        look_behind = true;
      }

      // If the current token is not found in the after_tokens, it won't match and we can move on.
      var after_token_locations = after_map[before_token.key];
      if(!after_token_locations) {
        continue;
      }

      // For each instance of the current token in after_tokens, let's see how big of a match we can
      // build.
      after_token_locations.forEach(function(after_index) {
        // get_full_match will see how far the current token match will go in both before_tokens
        // and after_tokens.
        var best_match_length = best_match ? best_match.length : 0;
        var match = get_full_match(segment, before_index, after_index, best_match_length,
          look_behind);

        // If we got a new best match, we'll save it aside.
        if (match && match.length > best_match_length) {
          best_match = match;
        }
      });
    }

    return best_match;
  }


  /**
   * Takes the start of a match, and expands it in the before_tokens and after_tokens of the
   * current segment as far as it can go.
   *
   * @param {Segment} segment The segment object to search within when expanding the match.
   * @param {number} before_start The offset within before_tokens to start looking.
   * @param {number} after_start The offset within after_tokens to start looking.
   * @param {number} min_length The minimum length match that must be found.
   * @param {boolean} look_behind If true, attempt to match a whitespace token just before the
   *    before_start and after_start tokens.
   *
   * @return {Match} The full match.
   */
  function get_full_match(segment, before_start, after_start, min_length, look_behind) {
    var before_tokens = segment.before_tokens;
    var after_tokens = segment.after_tokens;

    // If we already have a match that goes to the end of the document, no need to keep looking.
    var min_before_index = before_start + min_length;
    var min_after_index = after_start + min_length;
    if(min_before_index >= before_tokens.length || min_after_index >=   after_tokens.length) {
      return;
    }

    // If a min_length was provided, we can do a quick check to see if the tokens after that length
    // match. If not, we won't be beating the previous best match, and we can bail out early.
    if (min_length) {
      var next_before_word = before_tokens[min_before_index].key;
      var next_after_word = after_tokens[min_after_index].key;
      if (next_before_word !== next_after_word) {
        return;
      }
    }

    // Extend the current match as far foward as it can go, without overflowing before_tokens or
    // after_tokens.
    var searching = true;
    var current_length = 1;
    var before_index = before_start + current_length;
    var after_index = after_start + current_length;

    while (searching && before_index < before_tokens.length && after_index < after_tokens.length) {
      var before_word = before_tokens[before_index].key;
      var after_word = after_tokens[after_index].key;
      if (before_word === after_word) {
        current_length++;
        before_index = before_start + current_length;
        after_index = after_start + current_length;
      } else {
        searching = false;
      }
    }

    // If we've been asked to look behind, it's because both before_tokens and after_tokens may have
    // a whitespace token just behind the current match that was previously ignored. If so, we'll
    // expand the current match to include it.
    if (look_behind && before_start > 0 && after_start > 0) {
      var prev_before_key = before_tokens[before_start - 1].key;
      var prev_after_key = after_tokens[after_start - 1].key;
      if (prev_before_key === ' ' && prev_after_key === ' ') {
        before_start--;
        after_start--;
        current_length++;
      }
    }

    return new Match(before_start, after_start, current_length, segment);
  }

  /**
   * Creates segment objects from the original document that can be used to restrict the area that
   * find_best_match and it's helper functions search to increase performance.
   *
   * @param {Array.<Token>} before_tokens Tokens from the before document.
   * @param {Array.<Token>} after_tokens Tokens from the after document.
   * @param {number} before_index The index within the before document where this segment begins.
   * @param {number} after_index The index within the after document where this segment behinds.
   *
   * @return {Segment} The segment object.
   */
  function create_segment(before_tokens, after_tokens, before_index, after_index) {
    return {
      before_tokens: before_tokens,
      after_tokens: after_tokens,
      before_map: create_index(before_tokens),
      after_map: create_index(after_tokens),
      before_index: before_index,
      after_index: after_index
    };
  }

  /*
   * Finds all the matching blocks within the given segment in the before and after lists of
   * tokens.
   *
   * @param {Segment} The segment that should be searched for matching blocks.
   *
   * @return {Array.<Match>} The list of matching blocks in this range.
   */
  function find_matching_blocks(segment){
    // Create a binary search tree to hold the matches we find in order.
    var matches = new MatchBinarySearchTree();
    var match;
    var segments = [segment];

    // Each time the best match is found in a segment, zero, one or two new segments may be created
    // from the parts of the original segment not included in the match. We will continue to
    // iterate until all segments have been processed.
    while(segments.length) {
      segment = segments.pop();
      match = find_best_match(segment);

      if (match && match.length){
        // If there's an unmatched area at the start of the segment, create a new segment from that
        // area and throw it into the segments array to get processed.
        if (match.segment_start_in_before > 0 && match.segment_start_in_after > 0){
          var left_before_tokens = segment.before_tokens.slice(0, match.segment_start_in_before);
          var left_after_tokens = segment.after_tokens.slice(0, match.segment_start_in_after);

          segments.push(create_segment(left_before_tokens, left_after_tokens, segment.before_index,
            segment.after_index));
        }

        // If there's an unmatched area at the end of the segment, create a new segment from that
        // area and throw it into the segments array to get processed.
        var right_before_tokens = segment.before_tokens.slice(match.segment_end_in_before + 1);
        var right_after_tokens = segment.after_tokens.slice(match.segment_end_in_after + 1);
        var right_before_index = segment.before_index + match.segment_end_in_before + 1;
        var right_after_index = segment.after_index + match.segment_end_in_after + 1;

        if (right_before_tokens.length && right_after_tokens.length) {
          segments.push(create_segment(right_before_tokens, right_after_tokens, right_before_index,
            right_after_index));
        }
        
        matches.add(match);
      }
    }

    return matches.to_array();
  }

  /*
   * Gets a list of operations required to transform the before list of tokens into the
   * after list of tokens. An operation describes whether a particular list of consecutive
   * tokens are equal, replaced, inserted, or deleted.
   *
   * @param {Array.<string>} before_tokens The before list of tokens.
   * @param {Array.<string>} after_tokens The after list of tokens.
   *
   * @return {Array.<Object>} The list of operations to transform the before list of
   *      tokens into the after list of tokens, where each operation has the following
   *      keys:
   *      - {string} action One of {'replace', 'insert', 'delete', 'equal'}.
   *      - {number} start_in_before The beginning of the range in the list of before tokens.
   *      - {number} end_in_before The end of the range in the list of before tokens.
   *      - {number} start_in_after The beginning of the range in the list of after tokens.
   *      - {number} end_in_after The end of the range in the list of after tokens.
   */
  function calculate_operations(before_tokens, after_tokens){
    if (!before_tokens){
      throw new Error('before_tokens?');
    }
    if (!after_tokens){
      throw new Error('after_tokens?');
    }

    var position_in_before = 0;
    var position_in_after = 0;
    var operations = [];
    var action_map = {
      'false,false': 'replace',
      'true,false': 'insert',
      'false,true': 'delete',
      'true,true': 'none'
    };
    var segment = create_segment(before_tokens, after_tokens, 0, 0);
    var matches = find_matching_blocks(segment);
    matches.push(new Match(before_tokens.length, after_tokens.length, 0, segment));

    for (var index = 0; index < matches.length; index++){
      var match = matches[index];
      var match_starts_at_current_position_in_before = position_in_before === match.start_in_before;
      var match_starts_at_current_position_in_after = position_in_after === match.start_in_after;
      var action_up_to_match_positions = action_map[[match_starts_at_current_position_in_before, match_starts_at_current_position_in_after].toString()];
      if (action_up_to_match_positions !== 'none'){
        operations.push({
          action: action_up_to_match_positions,
          start_in_before: position_in_before,
          end_in_before: (action_up_to_match_positions !== 'insert' ? match.start_in_before - 1 : void 0),
          start_in_after: position_in_after,
          end_in_after: (action_up_to_match_positions !== 'delete' ? match.start_in_after - 1 : void 0)
        });
      }
      if (match.length !== 0){
        operations.push({
          action: 'equal',
          start_in_before: match.start_in_before,
          end_in_before: match.end_in_before,
          start_in_after: match.start_in_after,
          end_in_after: match.end_in_after
        });
      }
      position_in_before = match.end_in_before + 1;
      position_in_after = match.end_in_after + 1;
    }

    var post_processed = [];
    var last_op = {
      action: 'none'
    };

    function is_single_whitespace(op){
      if (op.action !== 'equal'){
        return false;
      }
      if (op.end_in_before - op.start_in_before !== 0){
        return false;
      }
      return /^\s$/.test(before_tokens.slice(op.start_in_before, op.end_in_before + 1));
    }

    for (var i = 0; i < operations.length; i++){
      var op = operations[i];

      if ((is_single_whitespace(op) && last_op.action === 'replace') ||
          (op.action === 'replace' && last_op.action === 'replace')){
        last_op.end_in_before = op.end_in_before;
        last_op.end_in_after = op.end_in_after;
      } else {
        post_processed.push(op);
        last_op = op;
      }
    }
    return post_processed;
  }

  /*
   * Returns a list of tokens of a particular type starting at a given index.
   *
   * @param {number} start The index of first token to test.
   * @param {Array.<string>} content The list of tokens.
   * @param {function} predicate A function that returns true if a token is of
   *      a particular type, false otherwise. It should accept the following
   *      parameters:
   *      - {string} The token to test.
   */
  function consecutive_where(start, content, predicate){
    content = content.slice(start, content.length + 1);
    var last_matching_index = null;

    for (var index = 0; index < content.length; index++){
      var token = content[index];
      var answer = predicate(token);

      if (answer === true){
        last_matching_index = index;
      }
      if (answer === false){
        break;
      }
    }

    if (last_matching_index !== null){
      return content.slice(0, last_matching_index + 1);
    }
    return [];
  }

  /*
   * Wraps and concatenates a list of tokens with a tag. Does not wrap tag tokens,
   * unless they are wrappable (i.e. void and atomic tags).
   *
   * @param {sting} tag The tag name of the wrapper tags.
   * @param {Array.<string>} content The list of tokens to wrap.
   * @param {string} class_name (Optional) The class name to include in the wrapper tag.
   */
  function wrap(tag, content, class_name){
    var rendering = '';
    var position = 0;
    var length = content.length;

    while (true){
      if (position >= length) break;
      var non_tags = consecutive_where(position, content, is_wrappable);
      position += non_tags.length;
      if (non_tags.length !== 0){
        var val = non_tags.join('');
        var attrs = class_name ? ' class="' + class_name + '"' : '';
        if (val.trim()){
          rendering += '<' + tag + attrs + '>' + val + '</' + tag + '>';
        }
      }

      if (position >= length) break;
      var tags = consecutive_where(position, content, is_tag);
      position += tags.length;
      rendering += tags.join('');
    }
    return rendering;
  }

  /*
   * op_map.equal/insert/delete/replace are functions that render an operation into
   * HTML content.
   *
   * @param {Object} op The operation that applies to a prticular list of tokens. Has the
   *      following keys:
   *      - {string} action One of {'replace', 'insert', 'delete', 'equal'}.
   *      - {number} start_in_before The beginning of the range in the list of before tokens.
   *      - {number} end_in_before The end of the range in the list of before tokens.
   *      - {number} start_in_after The beginning of the range in the list of after tokens.
   *      - {number} end_in_after The end of the range in the list of after tokens.
   * @param {Array.<string>} before_tokens The before list of tokens.
   * @param {Array.<string>} after_tokens The after list of tokens.
   * @param {string} class_name (Optional) The class name to include in the wrapper tag.
   *
   * @return {string} The rendering of that operation.
   */
  var op_map = {
    'equal': function(op, before_tokens, after_tokens, class_name){
      return after_tokens.slice(op.start_in_after, op.end_in_after + 1).reduce(
          function(prev, curr) {
        return prev + curr.string;
      }, '');
    },
    'insert': function(op, before_tokens, after_tokens, class_name){
      var val = after_tokens.slice(op.start_in_after, op.end_in_after + 1).map(function(token) {
        return token.string;
      });
      return wrap('ins', val, class_name);
    },
    'delete': function(op, before_tokens, after_tokens, class_name){
      var val = before_tokens.slice(op.start_in_before, op.end_in_before + 1).map(function(token) {
        return token.string;
      });
      return wrap('del', val, class_name);
    }
  };

  op_map.replace = function(op, before_tokens, after_tokens, class_name){
    return (op_map['delete'](op, before_tokens, after_tokens, class_name)) +
      (op_map.insert(op, before_tokens, after_tokens, class_name));
  };

  /*
   * Renders a list of operations into HTML content. The result is the combined version
   * of the before and after tokens with the differences wrapped in tags.
   *
   * @param {Array.<string>} before_tokens The before list of tokens.
   * @param {Array.<string>} after_tokens The after list of tokens.
   * @param {Array.<Object>} operations The list of operations to transform the before
   *      list of tokens into the after list of tokens, where each operation has the
   *      following keys:
   *      - {string} action One of {'replace', 'insert', 'delete', 'equal'}.
   *      - {number} start_in_before The beginning of the range in the list of before tokens.
   *      - {number} end_in_before The end of the range in the list of before tokens.
   *      - {number} start_in_after The beginning of the range in the list of after tokens.
   *      - {number} end_in_after The end of the range in the list of after tokens.
   * @param {string} class_name (Optional) The class name to include in the wrapper tag.
   *
   * @return {string} The rendering of the list of operations.
   */
  function render_operations(before_tokens, after_tokens, operations, class_name){
    var rendering = '';
    for (var i = 0; i < operations.length; i++){
      var op = operations[i];
      rendering += op_map[op.action](op, before_tokens, after_tokens, class_name);
    }
    return rendering;
  }

  /*
   * Compares two pieces of HTML content and returns the combined content with differences
   * wrapped in <ins> and <del> tags.
   *
   * @param {string} before The HTML content before the changes.
   * @param {string} after The HTML content after the changes.
   * @param {string} class_name (Optional) The class attribute to include in <ins> and <del> tags.
   *
   * @return {string} The combined HTML content with differences wrapped in <ins> and <del> tags.
   */
  function diff(before, after, class_name){
    if (before === after) return before;
    before = html_to_tokens(before);
    after = html_to_tokens(after);
    var ops = calculate_operations(before, after);
    return render_operations(before, after, ops, class_name);
  }

  diff.html_to_tokens = html_to_tokens;
  diff.find_matching_blocks = find_matching_blocks;
  find_matching_blocks.find_best_match = find_best_match;
  find_matching_blocks.create_index = create_index;
  find_matching_blocks.create_token = create_token;
  find_matching_blocks.create_segment = create_segment;
  find_matching_blocks.get_key_for_token = get_key_for_token;
  diff.calculate_operations = calculate_operations;
  diff.render_operations = render_operations;

  if (typeof define === 'function'){
    define([], function(){
      return diff;
    });
  } else if (typeof module !== 'undefined' && module !== null){
    module.exports = diff;
  } else {
    this.htmldiff = diff;
  }

}).call(this);