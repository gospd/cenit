module Setup
  class Algorithm
    include CenitScoped
    include CustomTitle

    BuildInDataType.regist(self).referenced_by(:name)

    field :name_space, type: String
    field :name, type: Symbol
    field :description, type: String
    embeds_many :parameters, class_name: Setup::AlgorithmParameter.to_s, inverse_of: :algorithm
    field :code, type: String
    embeds_many :call_links, class_name: Setup::CallLink.to_s, inverse_of: :algorithm

    validates_presence_of :name_space, :name, :code, :description
    validates_length_of :name_space, maximum: 255
    validates_format_of :name, with: /\A[a-z]([a-z]|\_|\d)*\Z/
    validates_uniqueness_of :name, scope: :name_space

    accepts_nested_attributes_for :parameters, allow_destroy: true
    accepts_nested_attributes_for :call_links, update_only: true

    before_save :validate_code

    def validate_code
      Capataz.rewrite(code, halt_on_error: false, logs: logs = {})
      if logs[:errors].present?
        logs[:errors].each { |msg| errors.add(:code, msg) }
        self.call_links = []
      else
        links = []
        (logs[:self_sends] || []).each do |call_name|
          if call_link = call_links.where(name: call_name).first
            links << call_link
          else
            links << Setup::CallLink.new(name: call_name)
          end
        end
        self.call_links = links
        do_link
      end
    end

    def do_link
      call_links.each { |call_link| call_link.do_link }
    end

    def run(input)
      input = Cenit::Utility.json_value_of(input)
      input = [input] unless input.is_a?(Array)
      args = {}
      parameters.each { |parameter| args[parameter.name] = input.shift }
      do_link
      Cenit::RubyInterpreter.run(code, self, args)
    end

    def link?(call_symbol)
      link(call_symbol).present?
    end

    def link(call_symbol)
      if call_link = call_links.where(name: call_symbol).first
        call_link.do_link
      else
        nil
      end
    end

    def scope_title
      name_space
    end
  end
end