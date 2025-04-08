struct VertexInput {
	@location(0) position: vec4<f32>,
	@location(1) values: vec4<f32>, 
};

struct VertexOutput {
    	@builtin(position) clip_position: vec4<f32>,
	@location(0) position: vec4<f32>,
	@location(1) values: vec4<f32>
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    // move to center
    output.clip_position = 2*input.position - vec4<f32>(1.0, 1.0, 0.0, 0.0);
    // magnify
    output.clip_position.x *= 2.0;
    output.clip_position.y *= 2.0;
    // invert y
    output.clip_position.y = -output.clip_position.y;
    output.position = input.position;
    output.values = input.values;
    return output;
}
