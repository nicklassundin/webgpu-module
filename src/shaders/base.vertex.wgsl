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
    output.clip_position = input.position;
    output.position = input.position;
    output.values = input.values;
    return output;
}
